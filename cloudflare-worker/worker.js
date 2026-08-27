// ペイ択「✨ リンクから取り込む」用の中継サーバー（Cloudflare Workers）
//
// 使っているAI：Google Gemini API（無料枠・クレジットカード登録不要）
//   https://aistudio.google.com/apikey で発行したAPIキーを使う。
//   Gemini自身の「Web検索」機能は課金対象になりやすいため使わず、
//   代わりにこのWorkerが入力されたURLのページを直接取得（サーバー側なのでCORSの制約を受けない）し、
//   その本文をGeminiに読ませて構造化データを抽出させる方式にしている。
//   これなら検索課金は一切発生しない。
//
// ⚠️ 認証について：
//   Originヘッダーのチェックだけでは「本人確認」にはならない（ブラウザ以外からは
//   Originを自由に偽装できるため）。そのためこのWorkerは、フロント側の編集モードと
//   同じパスワードのハッシュ（EDITOR_PASSWORD_HASH）を必須のシークレットとして要求し、
//   リクエストごとに送られてくる平文パスワードのSHA-256ハッシュと突き合わせている。
//   デプロイ前に必ず `wrangler secret put EDITOR_PASSWORD_HASH` を実行し、
//   scripts/app.js の EDITOR_PASSWORD_HASH と同じ値を設定してください（README参照）。
//
// デプロイ手順は README.md を参照してください。

const ALLOWED_ORIGINS = [
  "https://paytaku.github.io",
  // 独自ドメインを使っている場合はここに追加
  // "https://paytaku.example.com",
];

// ローカルでの動作確認用（本番では上のALLOWED_ORIGINSだけで十分ならこの行は削除してOK）
const ALLOW_LOCALHOST = true;

const GEMINI_MODEL = "gemini-2.5-flash"; // 無料枠対象モデル
const MAX_PAGE_CHARS = 12000; // Geminiに渡す本文の上限（長すぎるとトークンを消費しすぎる）

// 簡易レート制限・ブルートフォース対策（env.RATE_LIMIT_KVを使用。必須）。
// 1つのIPからの大量アクセスによるGemini APIクォータの浪費や、パスワードの
// 総当たり攻撃を防ぐための仕組み。
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1時間
const RATE_LIMIT_MAX_REQUESTS = 20; // 1時間あたりの上限リクエスト数（IPごと）
const AUTH_FAIL_THRESHOLD = 5; // この回数連続でパスワードを間違えたらロックアウトする
const AUTH_FAIL_WINDOW_SECONDS = 900; // 失敗カウントの有効期間（15分。この間に成功しなければ蓄積する）
const AUTH_LOCKOUT_SECONDS = 900; // ロックアウトの継続時間（15分）

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    store: { type: "STRING" },
    category: { type: "STRING" },
    card: { type: "STRING" },
    rate: { type: "STRING" },
    method: { type: "STRING" },
    expires: { type: "STRING" },
    note: { type: "STRING" },
    url: { type: "STRING" },
    confidence: { type: "STRING" },
    warning: { type: "STRING" },
  },
  required: ["store", "card", "confidence"],
};

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// タイミング攻撃を避けるため、長さが揃っている前提で定数時間比較する。
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// env.RATE_LIMIT_KV を使った、IPごとの簡易レート制限（総リクエスト数）。
async function checkRateLimit(env, ip) {
  if (!ip) return true;
  const key = `rl:${ip}`;
  let count = 0;
  try {
    count = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10) || 0;
  } catch (_e) {
    return true; // KV障害時は機能を止めない
  }
  if (count >= RATE_LIMIT_MAX_REQUESTS) return false;
  try {
    await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  } catch (_e) {
    /* ignore */
  }
  return true;
}

// このIPが、直近のパスワード連続失敗によってロックアウト中かどうか。
async function isLockedOut(env, ip) {
  if (!ip) return false;
  try {
    return !!(await env.RATE_LIMIT_KV.get(`lock:${ip}`));
  } catch (_e) {
    return false; // KV障害時は機能を止めない
  }
}

// パスワード認証の失敗を記録し、閾値を超えたら一定時間ロックアウトする。
async function recordAuthFailure(env, ip) {
  if (!ip) return;
  const key = `fail:${ip}`;
  try {
    const count = (parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10) || 0) + 1;
    if (count >= AUTH_FAIL_THRESHOLD) {
      await env.RATE_LIMIT_KV.put(`lock:${ip}`, "1", { expirationTtl: AUTH_LOCKOUT_SECONDS });
      await env.RATE_LIMIT_KV.delete(key).catch(() => {});
    } else {
      await env.RATE_LIMIT_KV.put(key, String(count), { expirationTtl: AUTH_FAIL_WINDOW_SECONDS });
    }
  } catch (_e) {
    /* ignore */
  }
}

// パスワード認証に成功したら、それまでの失敗カウントをリセットする。
async function clearAuthFailures(env, ip) {
  if (!ip) return;
  try {
    await env.RATE_LIMIT_KV.delete(`fail:${ip}`);
  } catch (_e) {
    /* ignore */
  }
}

// 抽出元ページ（fetchedUrl）と、AIが返したurlのドメインが一致するかどうか。
// www. の有無だけの違いは同一とみなすが、それ以外のドメイン違いは
// フィッシングサイト等が混入した可能性として扱う。
function hostsMatch(a, b) {
  const norm = (h) => String(h || "").replace(/^www\./i, "").toLowerCase();
  return norm(a) === norm(b);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const originOk =
      ALLOWED_ORIGINS.includes(origin) ||
      (ALLOW_LOCALHOST && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // ⚠️ Originヘッダーはブラウザ以外（curl・スクリプト等）からは自由に偽装できるため、
    // これは「本人確認」ではなく簡易的なブラウザ向けフィルタに過ぎない。
    // 実際の認証は下のパスワード検証で行う。
    if (!originOk) {
      return json({ error: { message: "許可されていないOriginです" } }, 403, cors);
    }

    if (request.method !== "POST") {
      return json({ error: { message: "POSTのみ対応しています" } }, 405, cors);
    }

    if (!env.RATE_LIMIT_KV) {
      return json(
        {
          error: {
            message:
              "サーバー側に RATE_LIMIT_KV が設定されていません（README参照）。パスワードの総当たり攻撃を防ぐために必須です。KV Namespaceを作成し、wrangler.tomlにバインドしてください。",
          },
        },
        500,
        cors
      );
    }

    const ip = request.headers.get("CF-Connecting-IP") || "";

    if (await isLockedOut(env, ip)) {
      return json(
        {
          error: {
            message: "認証に連続して失敗したため、このIPからのアクセスを一時的にブロックしています。しばらく時間をおいてから再度お試しください。",
          },
        },
        429,
        cors
      );
    }

    if (!(await checkRateLimit(env, ip))) {
      return json({ error: { message: "リクエストが多すぎます。しばらく待ってから再度お試しください。" } }, 429, cors);
    }

    if (!env.GEMINI_API_KEY) {
      return json(
        { error: { message: "サーバー側に GEMINI_API_KEY が設定されていません（wrangler secret put GEMINI_API_KEY）" } },
        500,
        cors
      );
    }

    if (!env.EDITOR_PASSWORD_HASH) {
      return json(
        {
          error: {
            message:
              "サーバー側に EDITOR_PASSWORD_HASH が設定されていません（wrangler secret put EDITOR_PASSWORD_HASH／scripts/app.jsのEDITOR_PASSWORD_HASHと同じ値を設定してください）",
          },
        },
        500,
        cors
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (_e) {
      return json({ error: { message: "リクエストのJSONが不正です" } }, 400, cors);
    }

    // パスワード検証：フロント側の編集モードと同じパスワードの平文を受け取り、
    // ここでハッシュ化してEDITOR_PASSWORD_HASHと突き合わせる（本人確認）。
    const password = (body.password || "").toString();
    const passwordHash = password ? await sha256Hex(password) : "";
    if (!password || !timingSafeEqual(passwordHash, env.EDITOR_PASSWORD_HASH)) {
      await recordAuthFailure(env, ip);
      return json({ error: { message: "認証に失敗しました（編集モードのパスワードが違います）" } }, 401, cors);
    }
    await clearAuthFailures(env, ip);

    const input = (body.input || "").toString().trim();
    if (!input) {
      return json({ error: { message: "input（URLまたは説明文）は必須です" } }, 400, cors);
    }
    const categories = Array.isArray(body.categories) ? body.categories : [];
    const storeNames = Array.isArray(body.storeNames) ? body.storeNames.slice(0, 40) : [];

    // 入力にURLが含まれていれば、サーバー側で直接そのページを取得する
    // （ブラウザ側からだとCORSでブロックされるため、この中継が必要）
    const urlMatch = input.match(/https?:\/\/[^\s]+/);
    let fetchedUrl = "";
    let pageText = "";
    let fetchNote = "";
    if (urlMatch) {
      fetchedUrl = urlMatch[0].replace(/[)\]。、,]+$/, ""); // 文末の句読点等を除去
      try {
        const pageRes = await fetch(fetchedUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PaytakuCampaignBot/1.0; +https://paytaku.github.io/)",
          },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          pageText = htmlToText(html).slice(0, MAX_PAGE_CHARS);
          if (!pageText) fetchNote = "ページは取得できましたが、本文を抽出できませんでした。";
        } else {
          fetchNote = `ページの取得に失敗しました（HTTP ${pageRes.status}）。`;
        }
      } catch (e) {
        fetchNote = `ページの取得に失敗しました（${e.message}）。`;
      }
    }

    const prompt = buildPrompt({ input, categories, storeNames, pageText, fetchedUrl, fetchNote });

    let gRes;
    try {
      gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
        }
      );
    } catch (e) {
      return json({ error: { message: `Gemini APIへの接続に失敗しました：${e.message}` } }, 502, cors);
    }

    if (!gRes.ok) {
      let detail = "";
      try {
        const errBody = await gRes.json();
        detail = errBody?.error?.message || "";
      } catch (_e) {
        /* ignore */
      }
      return json(
        { error: { message: `Gemini APIがエラーを返しました（HTTP ${gRes.status}）${detail ? "：" + detail : ""}` } },
        gRes.status === 429 ? 429 : 502,
        cors
      );
    }

    const gData = await gRes.json();
    const text = (gData?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    if (!text) {
      // 安全フィルタ等でブロックされた場合はここに来る
      const blockReason = gData?.candidates?.[0]?.finishReason || gData?.promptFeedback?.blockReason;
      return json(
        { error: { message: `応答が空でした${blockReason ? `（理由: ${blockReason}）` : ""}。` } },
        502,
        cors
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_e) {
      return json({ error: { message: "応答をJSONとして解釈できませんでした。" } }, 502, cors);
    }

    // urlが空ならフェッチしたURLを補っておく
    if (!parsed.url && fetchedUrl) parsed.url = fetchedUrl;
    if (parsed.expires === "null" || parsed.expires === "常設") parsed.expires = "";

    // 抽出元ページと、AIが返したurlのドメインが一致するか確認する。
    // 一致しない場合、フィッシングサイト等の混入の可能性があるため、
    // confidenceを強制的にlowにし、warningで強く注意を促す（保存前に必ず目視確認させるため）。
    if (fetchedUrl && parsed.url) {
      try {
        const sourceHost = new URL(fetchedUrl).hostname;
        const targetHost = new URL(parsed.url).hostname;
        if (!hostsMatch(sourceHost, targetHost)) {
          parsed.domainMismatch = true;
          parsed.confidence = "low";
          const mismatchMsg = `⚠️ 抽出元ページ（${sourceHost}）と出典URL（${targetHost}）のドメインが異なります。フィッシングサイト等が混入している可能性があるため、保存前に必ずリンク先を開いて公式サイトか確認してください。`;
          parsed.warning = parsed.warning ? `${mismatchMsg} ${parsed.warning}` : mismatchMsg;
        }
      } catch (_e) {
        /* URLとして解釈できない場合は比較をスキップ */
      }
    }

    return json(parsed, 200, cors);
  },
};

function buildPrompt({ input, categories, storeNames, pageText, fetchedUrl, fetchNote }) {
  const today = new Date().toISOString().slice(0, 10);
  const sourceBlock = pageText
    ? `【${fetchedUrl} の本文（自動取得・一部抜粋）】\n${pageText}\n\n上記の本文をもとに、還元キャンペーンの情報を抽出してください。本文に無い情報は推測で埋めず、confidence を low にしてください。`
    : `※このURL・説明文からページ本文を取得できませんでした。${fetchNote}\n一般的な知識をもとに分かる範囲で埋めてください。確認が取れていないので confidence は必ず low にし、warning にその旨を書いてください。`;

  return `あなたは日本のキャッシュレス決済・クレジットカード還元の専門アシスタントです。
以下の入力から、還元キャンペーンの情報を抽出してJSONで返してください。

【入力】
${input}

${sourceBlock}

【出力するJSON項目】
- store: 店舗・チェーン名
- category: 次のいずれかから選ぶ（該当が無ければ「その他」）: ${categories.join(" / ")}
- card: 決済手段の名前（例: 三井住友カード / Olive、PayPay、dカード）
- rate: 還元率（例: 7%、最大10〜11%、20倍）
- method: 対象となる支払い方法と、対象外の条件
- expires: 終了日をYYYY-MM-DD形式で。終了日が無い常設なら空文字
- note: 上限・エントリー要否・注意点を簡潔に。最後に［確認日: ${today}／出典: ${fetchedUrl ? "取得したページ" : "情報源不明"}］を付ける
- url: 根拠にしたページのURL（${fetchedUrl || "無ければ空文字"}）
- confidence: high / medium / low のいずれか
- warning: 情報が不確かな点があれば書く。無ければ空文字

【重要な注意】
- 本文の文章をそのまま引き写さず、条件を自分の言葉で要約してください。
- 「スマホのタッチ決済のみ対象」「カード現物のタッチは対象外」のような、対象取引の細かい違いは還元を受けられるかどうかを左右するので必ず method に含めてください。
- 確認できなかった項目は推測で埋めず、confidence を low にして warning に理由を書いてください。
- category は必ず指定した選択肢の中から選んでください。
- 既に登録済みの店舗名がある場合はその表記に合わせてください: ${storeNames.join("、")}`;
}

// 簡易HTML→テキスト変換（依存ライブラリ無しで動かすための最小実装）
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
