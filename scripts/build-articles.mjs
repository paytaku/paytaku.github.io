#!/usr/bin/env node
/**
 * build-articles.mjs
 *
 * content/articles.json を読み込み、記事ごとに静的HTML（articles/{slug}.html）を生成する。
 * ハッシュルーティング（index.html#/pick/xxx）だと、クローラーやASP審査から見て
 * 「別ページ」として認識されにくいため、記事本文が最初から入った実ファイルを出力する方式に切り替えた。
 *
 * 使い方:
 *   node scripts/build-articles.mjs
 *
 * 実行すると、リポジトリ直下に以下が生成される（既存ファイルは上書き）:
 *   /articles/{slug}.html   ... 記事本体
 *   /articles/index.html    ... 記事一覧
 *
 * 新しい記事を追加するには content/articles.json に項目を追加して、このスクリプトを
 * 再実行するだけでよい（GitHub Actionsで自動実行する設定は .github/workflows/build-articles.yml を参照）。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ARTICLES_JSON = join(ROOT, "content", "articles.json");
const OUT_DIR = join(ROOT, "articles");
const THUMBS_DIR = join(ROOT, "assets", "thumbnails");
const THUMB_EXTS = ["png", "jpg", "jpeg", "webp"];

/**
 * assets/thumbnails/{slug}.{png|jpg|jpeg|webp} が存在すれば、そのパスを返す。
 * articles.json に明示的な thumbnail フィールドがあればそちらを優先する
 * （外部URLを使いたい場合はそちらで上書きできる）。
 */
function resolveThumbnail(slug, explicitThumbnail){
  if(explicitThumbnail) return explicitThumbnail;
  for(const ext of THUMB_EXTS){
    if(existsSync(join(THUMBS_DIR, `${slug}.${ext}`))){
      return `../assets/thumbnails/${slug}.${ext}`;
    }
  }
  return null;
}

const SITE_NAME = "ペイ択（Paytaku）";
const SITE_URL = "https://paytaku.github.io";

/* カテゴリ別のサムネイル・フォールバック（thumbnailフィールドが無い記事に使う） */
const THUMB_GRADIENT = {
  "カード解説": "linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)",
  "キャンペーン": "linear-gradient(135deg,#7C3AED 0%,#EC4899 100%)",
  "証券・投資": "linear-gradient(135deg,#10B981 0%,#059669 100%)",
  "チャージルート": "linear-gradient(135deg,#F59E0B 0%,#D97706 100%)",
  "ポイントサイト": "linear-gradient(135deg,#06B6D4 0%,#0891B2 100%)"
};
const THUMB_ICON = {
  "カード解説": "💳",
  "キャンペーン": "🎁",
  "証券・投資": "📈",
  "チャージルート": "🔌",
  "ポイントサイト": "🎯"
};
const CATEGORY_ORDER = ["すべて", "キャンペーン", "カード解説", "証券・投資", "チャージルート", "ポイントサイト"];

/* PR枠（実データではなく広告枠。運用時はここだけ書き換える） */
const PR_CARD = {
  category: "カード解説",
  title: "楽天カードは年会費永年無料でポイントが貯まりやすい定番カード｜新規入会でポイントプレゼント中",
  overview: "年会費永年無料、還元率1.0%からスタート。楽天市場での買い物はSPUの上乗せでさらに還元率アップ。今なら新規入会・利用でポイントがもらえるキャンペーンを実施中です。",
  updatedDate: "2026-08-20",
  ctaUrl: "#", // affKey優先。ここはaffiliates.json取得失敗時のフォールバック用
  affKey: "rakuten-card", // affiliates.json の links.rakuten-card がリンク先として使われる
  bannerKey: "rakuten-card", // affiliates.json の banners.rakuten-card が画像として使われる
  bannerIdx: 1 // banners.rakuten-card の何番目を使うか（0=券面画像, 1=ポイント訴求）
};

function esc(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readArticles(){
  const raw = readFileSync(ARTICLES_JSON, "utf-8");
  const list = JSON.parse(raw);
  if(!Array.isArray(list)) throw new Error("articles.json must be an array");
  return list;
}

function metaDescriptionFor(a){
  const src = a.overview || a.leadText || a.title || "";
  return src.length > 110 ? src.slice(0, 110) + "…" : src;
}

function stepsHtml(steps){
  if(!steps || !steps.length) return "";
  return steps.map((s, i) => `
      <div class="lp-flow-step">
        <div class="lp-flow-num">${i + 1}</div>
        <div>${esc(s)}</div>
      </div>
      ${i < steps.length - 1 ? '<div class="lp-flow-arrow">↓</div>' : ""}`).join("\n");
}

function overviewLabel(a){
  return a.category === "カード解説" ? "カードの概要" : "このキャンペーンの概要";
}

function tocHtml(a){
  const items = [
    `<li><a href="#overview">${overviewLabel(a)}</a></li>`,
  ];
  if(a.steps && a.steps.length) items.push(`<li><a href="#steps">使い方の手順</a></li>`);
  if(a.note) items.push(`<li><a href="#note">注意点・詳細条件</a></li>`);
  if(a.period) items.push(`<li><a href="#period">実施期間</a></li>`);
  items.push(`<li><a href="#summary">まとめ</a></li>`);
  return `<div class="lp-toc-title">この記事の内容</div><ol>${items.join("")}</ol>`;
}

function relatedHtml(a, bySlug){
  const rel = (a.related || []).map(slug => bySlug.get(slug)).filter(Boolean).slice(0, 3);
  if(!rel.length) return "";
  return `
    <section class="lp-section">
      <h2 class="lp-section-title">あわせて読みたい</h2>
      <div class="lp-related">
        ${rel.map(r => `<a class="lp-related-item" href="./${r.slug}.html">${esc(r.title)}</a>`).join("\n        ")}
      </div>
    </section>`;
}

function tagsHtml(a){
  if(!a.tags || !a.tags.length) return "";
  return `<p class="lp-body-text" style="font-size:12px;color:var(--dim);">タグ：${a.tags.map(esc).join("　")}</p>`;
}

function periodSectionHtml(a){
  if(!a.period) return "";
  const text = a.expires ? `${a.period}（〜${a.expires}まで）` : a.period;
  return `
    <section class="lp-section">
      <h2 class="lp-section-title" id="period">実施期間</h2>
      <p class="lp-body-text">${esc(text)}</p>
    </section>`;
}

function noteSectionHtml(a){
  if(!a.note) return "";
  return `
    <section class="lp-section">
      <h2 class="lp-section-title" id="note">注意点・詳細条件</h2>
      <p class="lp-body-text">${esc(a.note)}</p>
    </section>`;
}

function stepsSectionHtml(a){
  if(!a.steps || !a.steps.length) return "";
  return `
    <section class="lp-section">
      <h2 class="lp-section-title" id="steps">使い方の手順</h2>
      <div class="lp-flow">
${stepsHtml(a.steps)}
      </div>
    </section>`;
}

function ctaButtonLabel(a){
  const base = a.ctaLabel || "公式ページで詳細を見る";
  return a.affiliate ? `${base}（PR）` : base;
}

function bannerSectionHtml(a){
  if(!a.bannerImageUrl || !a.bannerLinkUrl) return "";
  return `
    <div class="lp-banner-box">
      <div class="lp-banner-label">📣 PR</div>
      <a href="${esc(a.bannerLinkUrl)}" target="_blank" rel="sponsored noopener nofollow">
        <img src="${esc(a.bannerImageUrl)}" alt="${esc(a.bannerAlt || a.title)}" class="lp-banner-img">
      </a>
    </div>`;
}

function articleTemplate(a, bySlug){
  const leadParts = [];
  if(a.rate) leadParts.push(a.rate);
  if(a.period) leadParts.push(a.period);
  const lead = leadParts.length
    ? `${esc(leadParts.join("／"))}で使える、ペイ択がチェックしているキャンペーンです。`
    : "ペイ択がチェックしているキャンペーンです。";

  const pageTitle = `${a.title} | ${SITE_NAME}`;
  const description = metaDescriptionFor(a);
  const canonical = `${SITE_URL}/articles/${a.slug}.html`;

  // Article構造化データ（JSON-LD）。customHtmlの記事はHTML側に直接埋め込まれているが、
  // このテンプレートで都度生成するキャンペーン系記事はここで生成しないと再ビルドのたびに消えてしまう。
  const articleJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": a.title,
    "description": a.overview || description,
    "datePublished": a.publishedDate || "",
    "dateModified": a.updatedDate || a.publishedDate || "",
    "author": { "@type": "Organization", "name": SITE_NAME },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/assets/logo.png` }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical }
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="ja" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="../assets/articles.css">
<link rel="apple-touch-icon" sizes="180x180" href="../assets/apple-touch-icon-512.png">
<link rel="icon" type="image/png" sizes="512x512" href="../assets/apple-touch-icon-512.png">
<link rel="shortcut icon" href="../favicon.ico">
<script type="application/ld+json">
${articleJsonLd}
</script>
</head>
<body>

<header class="site-header">
  <div class="site-header-inner">
    <a class="site-logo" href="../index.html">ペイ<span>択</span></a>
    <span class="site-header-tagline">還元率比較・お得情報</span>
    <button class="theme-toggle" id="themeToggle" aria-label="ダークモード切替" title="ダークモード切替">🌙</button>
  </div>
</header>
<script>
(function(){
  var STORAGE_KEY = 'paytaku-theme';
  // 保存済みの選択が無ければ、本体アプリ（index.html）と同じくOS設定に合わせる。
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  var DEFAULT = prefersLight ? 'light' : 'dark';
  var saved = localStorage.getItem(STORAGE_KEY) || DEFAULT;
  document.documentElement.setAttribute('data-theme', saved);
  window.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('themeToggle');
    if(!btn) return;
    btn.textContent = saved === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', function(){
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  });
})();
</script>

<div class="lp-page">
  <div class="lp-wrap">
    <a href="../index.html" class="lp-back">← ペイ択トップに戻る</a>
    <nav class="lp-breadcrumb">
      <a href="../index.html">ホーム</a> ＞ <a href="./index.html">${esc(a.category || "記事")}</a> ＞ ${esc(a.title.length > 20 ? a.title.slice(0, 20) + "…" : a.title)}
    </nav>

    <div class="lp-hero">
      <div class="lp-badge">${esc(a.category || "今月のおすすめ")}</div>
      <h1 class="lp-title">${esc(a.title)}</h1>
      <p class="lp-tagline">${lead}</p>
      <div class="lp-byline">更新日：${esc(a.updatedDate || a.publishedDate || "")}　|　ペイ択編集部</div>
    </div>

    <nav class="lp-toc">
      ${tocHtml(a)}
    </nav>
${bannerSectionHtml(a)}
    <section class="lp-section">
      <h2 class="lp-section-title" id="overview">${overviewLabel(a)}</h2>
      <p class="lp-body-text">${esc(a.overview || "")}</p>
    </section>
${stepsSectionHtml(a)}
${noteSectionHtml(a)}
${periodSectionHtml(a)}
    <section class="lp-section">
      <h2 class="lp-section-title" id="summary">まとめ</h2>
      <p class="lp-body-text">${esc(a.conclusion || "")}</p>
      ${tagsHtml(a)}
    </section>

    <section class="lp-section lp-cta-section">
      <h2 class="lp-section-title">このキャンペーンを見る</h2>
      <p class="lp-cta-note">条件・還元率は変更される場合があります。ご利用前に必ず公式ページで最新情報をご確認ください。</p>
      <a href="${esc(a.ctaUrl || "#")}"${a.affKey ? ` data-aff="${esc(a.affKey)}"` : ""} class="lp-apply-btn" target="_blank" rel="noopener noreferrer nofollow sponsored">${esc(ctaButtonLabel(a))}</a>
    </section>
${relatedHtml(a, bySlug)}

    <div class="lp-disclosure">本ページの情報は掲載時点のものです。還元率・条件は変更される場合があるため、利用前に必ず公式サイトでご確認ください。本サイトはアフィリエイト広告を含みます。</div>
    <a href="../index.html" class="lp-back lp-back-bottom">← ペイ択トップに戻る</a>
  </div>
</div>
<script src="../assets/affiliates.js"></script>
</body>
</html>
`;
}

function indexTemplate(articles){
  const pageTitle = `記事一覧 | ${SITE_NAME}`;
  const description = "ペイ択が公開している、キャンペーン攻略・カード活用の記事一覧です。";
  const canonical = `${SITE_URL}/articles/index.html`;

  const slim = articles.map(a => ({
    slug: a.slug,
    category: a.category || "その他",
    title: a.title,
    overview: metaDescriptionFor(a),
    updatedDate: a.updatedDate || a.publishedDate || "",
    thumbnail: resolveThumbnail(a.slug, a.thumbnail) // assets/thumbnails/{slug}.png等を自動検出。articles.jsonのthumbnailフィールドがあればそちら優先
  }));
  const articlesJson = JSON.stringify(slim);
  const prJson = JSON.stringify(PR_CARD);
  const thumbGradientJson = JSON.stringify(THUMB_GRADIENT);
  const thumbIconJson = JSON.stringify(THUMB_ICON);
  const categoriesJson = JSON.stringify(CATEGORY_ORDER);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<link rel="apple-touch-icon" sizes="180x180" href="../assets/apple-touch-icon-512.png">
<link rel="icon" type="image/png" sizes="512x512" href="../assets/apple-touch-icon-512.png">
<link rel="shortcut icon" href="../favicon.ico">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { darkMode: 'class' };</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --fs-page-title:22px; --fs-page-sub:13px; --fs-section:16px;
    --fs-card-title:18px; --fs-card-desc:14px; --fs-tag:11px;
    --fs-date:11px; --fs-nav:10px; --pad-card:16px; --gap-card:16px;
    --pad-edge:16px; --h-btn:48px; --h-nav:64px;
    --page-max-width:430px;
  }
  /* 画面が広いときは記事一覧の幅も広げる（スマホはそのまま430px） */
  @media (min-width:700px){ :root{ --page-max-width:min(90vw, 720px); } }
  @media (min-width:1000px){ :root{ --page-max-width:960px; } }
  html.large{
    --fs-page-title:28px; --fs-page-sub:15px; --fs-section:20px;
    --fs-card-title:22px; --fs-card-desc:16px; --fs-tag:12px;
    --fs-date:12px; --fs-nav:12px; --pad-card:20px; --gap-card:20px;
    --pad-edge:20px; --h-btn:56px; --h-nav:72px;
  }
  html.large body{ line-height:1.6; }
  a{ text-decoration:none; }
  *{ -webkit-tap-highlight-color: transparent; }
  body{ max-width:var(--page-max-width); margin:0 auto !important; font-family:'Noto Sans JP','Hiragino Sans','Hiragino Kaku Gothic ProN',sans-serif; }
  .icon-btn{ -webkit-tap-highlight-color:transparent; }
  .icon-btn:active{ background-color:rgba(79,70,229,0.08); }
  html.dark .icon-btn:active{ background-color:rgba(129,140,248,0.15); }
  .card-link{ -webkit-tap-highlight-color:transparent; }
  .card-link:active{ transform:scale(0.99); }
  .thumb-pattern{
    background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 18px);
  }
  .thumb-16x9{ aspect-ratio:16/9; width:100%; display:flex; align-items:center; justify-content:center; }
  .clamp2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .fade-in{ animation:fadeIn .25s ease; }
  @keyframes fadeIn{ from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
  @media (prefers-reduced-motion: reduce){ .fade-in{ animation:none; } }
</style>
</head>
<body class="bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 min-h-screen pb-24">

<header class="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-700" style="height:56px;">
  <div class="h-full flex items-center justify-between px-4">
    <a href="../index.html" class="flex items-center gap-2">
      <img src="../assets/logo.png" alt="ペイ択 -PayTaku-" width="84" height="40" class="shrink-0">
    </a>
    <div class="flex items-center gap-1">
      <button id="fontToggle" aria-label="文字サイズ切替" class="icon-btn w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-[#4F46E5] dark:text-indigo-300 bg-[#EEF2FF] dark:bg-indigo-950/60">A+</button>
      <button id="themeToggle" aria-label="ダークモード切替" class="icon-btn w-9 h-9 rounded-full flex items-center justify-center text-[#64748B] dark:text-slate-300">🌙</button>
      <button aria-label="検索" class="icon-btn w-9 h-9 rounded-full flex items-center justify-center text-[#64748B] dark:text-slate-300">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <button id="menuToggle" aria-label="メニュー" aria-expanded="false" class="icon-btn w-9 h-9 rounded-full flex items-center justify-center text-[#64748B] dark:text-slate-300">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
</header>

<!-- メニューパネル -->
<div id="menuOverlay" class="hidden fixed inset-0 bg-black/40 z-40" style="max-width:var(--page-max-width); margin:0 auto;"></div>
<div id="menuPanel" class="hidden fixed top-0 right-0 h-full bg-white dark:bg-slate-900 z-50 shadow-2xl" style="width:78%; max-width:340px;">
  <div class="flex items-center justify-between px-4 border-b border-[#E2E8F0] dark:border-slate-700" style="height:56px;">
    <span class="font-bold text-[15px] text-[#0F172A] dark:text-white">メニュー</span>
    <button id="menuClose" aria-label="閉じる" class="icon-btn w-9 h-9 rounded-full flex items-center justify-center text-[#64748B] dark:text-slate-300">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  </div>
  <nav class="flex flex-col p-2">
    <a href="../index.html" class="px-3 py-3 rounded-lg text-[#0F172A] dark:text-white font-bold hover:bg-[#F8FAFC] dark:hover:bg-slate-800">ホーム</a>
    <a href="./index.html" class="px-3 py-3 rounded-lg text-[#0F172A] dark:text-white font-bold hover:bg-[#F8FAFC] dark:hover:bg-slate-800">記事一覧</a>
    <div class="my-1 border-t border-[#E2E8F0] dark:border-slate-700"></div>
    <button data-menu-cat="キャンペーン" class="text-left px-3 py-3 rounded-lg text-[#64748B] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800">キャンペーン</button>
    <button data-menu-cat="カード解説" class="text-left px-3 py-3 rounded-lg text-[#64748B] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800">カード解説</button>
    <button data-menu-cat="証券・投資" class="text-left px-3 py-3 rounded-lg text-[#64748B] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800">証券・投資</button>
    <button data-menu-cat="チャージルート" class="text-left px-3 py-3 rounded-lg text-[#64748B] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800">チャージルート</button>
    <button data-menu-cat="ポイントサイト" class="text-left px-3 py-3 rounded-lg text-[#64748B] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800">ポイントサイト</button>
  </nav>
</div>

<nav class="bg-[#F8FAFC] dark:bg-slate-800 px-4 py-2 text-[12px] text-[#64748B] dark:text-slate-400">
  <a href="../index.html" class="text-[#4F46E5] dark:text-indigo-300">ホーム</a> &gt; 記事一覧
</nav>

<div class="px-4 py-4 bg-white dark:bg-slate-900">
  <h1 class="font-bold text-[#0F172A] dark:text-white" style="font-size:var(--fs-page-title);">記事一覧</h1>
  <p class="mt-1.5 text-[#64748B] dark:text-slate-400" style="font-size:var(--fs-page-sub);">ペイ択の比較・攻略・カード活用・お得な支払い方法など、もっと生活を豊かにする情報をお届けします。</p>
</div>

<div class="px-4 pb-3 overflow-x-auto whitespace-nowrap" style="scrollbar-width:none;">
  <div class="inline-flex gap-2" id="filterChips"></div>
</div>

<main class="px-4" id="articleList" style="display:grid; gap:var(--gap-card); grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));"></main>
<p id="emptyState" class="hidden text-center text-[#94A3B8] dark:text-slate-500 py-10 text-[13px]">このカテゴリの記事は準備中です。</p>

<div class="px-4 mt-4">
  <a href="#" class="w-full flex items-center justify-center rounded-lg border border-[#E2E8F0] dark:border-slate-600 text-[#4F46E5] dark:text-indigo-300 font-bold hover:bg-[#F8FAFC] dark:hover:bg-slate-800" style="height:var(--h-btn);">もっと見る</a>
</div>

<nav class="fixed bottom-0 left-0 right-0 mx-auto bg-white dark:bg-slate-900 border-t border-[#E2E8F0] dark:border-slate-700 flex" style="max-width:var(--page-max-width); height:var(--h-nav); z-index:50;">
  <a href="../index.html" class="flex-1 flex flex-col items-center justify-center gap-1 text-[#4F46E5]">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 11L12 4L21 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10V20H19V10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="font-bold" style="font-size:var(--fs-nav);">ホーム</span>
  </a>
  <a href="../index.html#mode=stores" class="flex-1 flex flex-col items-center justify-center gap-1 text-[#64748B] dark:text-slate-400">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 9L12 3L21 9V20H15V14H9V20H3V9Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
    <span style="font-size:var(--fs-nav);">お店から選ぶ</span>
  </a>
  <a href="../index.html#mode=cards" class="flex-1 flex flex-col items-center justify-center gap-1 text-[#64748B] dark:text-slate-400">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10H21" stroke="currentColor" stroke-width="2"/></svg>
    <span style="font-size:var(--fs-nav);">カード選び</span>
  </a>
  <a href="../index.html#mode=routes" class="flex-1 flex flex-col items-center justify-center gap-1 text-[#64748B] dark:text-slate-400">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6H14a3 3 0 013 3v0a3 3 0 01-3 3H7a3 3 0 00-3 3v0a3 3 0 003 3h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <span style="font-size:var(--fs-nav);">チャージルート</span>
  </a>
  <a href="./index.html" class="flex-1 flex flex-col items-center justify-center gap-1 text-[#64748B] dark:text-slate-400">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 19V6C4 4.9 4.9 4 6 4H18C19.1 4 20 4.9 20 6V19L12 16L4 19Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
    <span style="font-size:var(--fs-nav);">記事</span>
  </a>
</nav>

<script>
const ARTICLES = ${articlesJson};
const PR = ${prJson};
const THUMB_GRADIENT = ${thumbGradientJson};
const THUMB_ICON = ${thumbIconJson};
const CATEGORIES = ${categoriesJson};

function fmtDate(s){ if(!s) return ""; const [y,m,d] = s.split("-"); return \`\${y}/\${m}/\${d}\`; }

function thumbHtml(a){
  if(a.thumbnail){
    return \`<div class="thumb-16x9"><img src="\${a.thumbnail}" alt="" class="w-full h-full object-cover" loading="lazy"></div>\`;
  }
  const bg = THUMB_GRADIENT[a.category] || THUMB_GRADIENT["カード解説"];
  const icon = THUMB_ICON[a.category] || "📄";
  return \`<div class="thumb-16x9 thumb-pattern text-white relative" style="background:\${bg};">
    <span style="font-size:56px; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.25));">\${icon}</span>
    <span class="absolute font-extrabold text-white/90" style="right:14px; bottom:10px; font-size:13px; letter-spacing:0.05em; text-shadow:0 1px 4px rgba(0,0,0,0.35);">\${a.category}</span>
  </div>\`;
}

function cardHtml(a){
  return \`
  <a href="./\${a.slug}.html" data-cat="\${a.category}" class="card-link fade-in block bg-[#F8FAFC] dark:bg-slate-800 rounded-2xl overflow-hidden border border-[#E2E8F0]/70 dark:border-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
    \${thumbHtml(a)}
    <div style="padding:var(--pad-card);">
      <span class="inline-block rounded-full bg-[#EEF2FF] dark:bg-indigo-950 text-[#4F46E5] dark:text-indigo-300 font-bold px-2 py-0.5" style="font-size:var(--fs-tag);">\${a.category}</span>
      <h3 class="clamp2 font-bold text-[#0F172A] dark:text-white" style="font-size:var(--fs-card-title); margin-top:8px;">\${a.title}</h3>
      <p class="clamp2 text-[#64748B] dark:text-slate-400" style="font-size:var(--fs-card-desc); margin-top:8px;">\${a.overview}</p>
      <p class="text-[#94A3B8] dark:text-slate-500 flex items-center gap-1" style="font-size:var(--fs-date); margin-top:12px;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10H21" stroke="currentColor" stroke-width="2"/><path d="M8 3V7M16 3V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        更新日：\${fmtDate(a.updatedDate)}
      </p>
    </div>
  </a>\`;
}

function prHtml(){
  return \`
  <a href="\${PR.ctaUrl}"\${PR.affKey ? \` data-aff="\${PR.affKey}"\` : ""} target="_blank" rel="noopener noreferrer nofollow sponsored"
     class="card-link fade-in block bg-[#FAF5FF] dark:bg-purple-950/40 rounded-2xl overflow-hidden border border-[#D8B4FE] dark:border-purple-800 shadow-[0_2px_8px_rgba(126,34,206,0.08)]">
    <div class="relative">
      <div class="thumb-16x9 thumb-pattern text-white relative overflow-hidden" style="background:linear-gradient(135deg,#7C3AED 0%,#EC4899 100%);">
        <span style="font-size:56px; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.25));">🎁</span>
        <div class="lp-banner-box absolute inset-0">
          <img data-aff-banner="\${PR.bannerKey}" data-aff-banner-idx="\${PR.bannerIdx}" alt="" class="w-full h-full object-cover" loading="lazy">
        </div>
      </div>
      <span class="absolute bg-[#7C3AED] text-white font-bold rounded px-2 py-0.5" style="font-size:10px; top:12px; left:12px;">PR</span>
    </div>
    <div style="padding:var(--pad-card);">
      <span class="inline-block rounded-full bg-[#EEF2FF] dark:bg-indigo-950 text-[#4F46E5] dark:text-indigo-300 font-bold px-2 py-0.5" style="font-size:var(--fs-tag);">\${PR.category}</span>
      <h3 class="clamp2 font-bold text-[#0F172A] dark:text-white" style="font-size:var(--fs-card-title); margin-top:8px;">\${PR.title}</h3>
      <p class="clamp2 text-[#64748B] dark:text-slate-400" style="font-size:var(--fs-card-desc); margin-top:8px;">\${PR.overview}</p>
      <div class="flex items-center justify-between" style="margin-top:12px;">
        <span class="text-[#94A3B8] dark:text-slate-500 flex items-center gap-1" style="font-size:var(--fs-date);">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10H21" stroke="currentColor" stroke-width="2"/><path d="M8 3V7M16 3V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          更新日：\${fmtDate(PR.updatedDate || "")}
        </span>
        <span class="text-[#94A3B8] dark:text-slate-500 flex items-center gap-1" style="font-size:var(--fs-date);" title="広告主から提供された情報をもとに作成しています">
          PRについて
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 11V17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/></svg>
        </span>
      </div>
    </div>
  </a>\`;
}

function render(cat){
  const list = document.getElementById('articleList');
  const empty = document.getElementById('emptyState');
  const filtered = cat === "すべて" ? ARTICLES : ARTICLES.filter(a => a.category === cat);
  if(filtered.length === 0){ list.innerHTML = ""; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  let html = "";
  filtered.forEach((a, i) => {
    html += cardHtml(a);
    if(i === 0 && cat === "すべて") html += prHtml(); // 1件目の直後にPRを1枚だけ挿入（全件表示時のみ）
  });
  list.innerHTML = html;
}

function styleChips(){
  document.querySelectorAll('.chip').forEach(b => {
    if(b.classList.contains('active-chip')){
      b.style.background = '#4F46E5'; b.style.color = '#fff'; b.style.borderColor = '#4F46E5';
    } else {
      b.style.background = ''; b.style.color = '#64748B'; b.style.borderColor = '#E2E8F0';
    }
  });
}

const chipsEl = document.getElementById('filterChips');
chipsEl.innerHTML = CATEGORIES.map((c,i) => \`<button data-cat="\${c}" class="chip\${i===0?' active-chip':''} rounded-full border px-4 py-2 font-bold" style="font-size:var(--fs-tag);height:36px;">\${c}</button>\`).join("");
chipsEl.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', () => {
    chipsEl.querySelectorAll('.chip').forEach(b => b.classList.remove('active-chip'));
    btn.classList.add('active-chip');
    styleChips();
    render(btn.dataset.cat);
  });
});
styleChips();

/* メニューパネル */
const menuToggle = document.getElementById('menuToggle');
const menuPanel = document.getElementById('menuPanel');
const menuOverlay = document.getElementById('menuOverlay');
const menuClose = document.getElementById('menuClose');
function openMenu(){
  menuPanel.classList.remove('hidden');
  menuOverlay.classList.remove('hidden');
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeMenu(){
  menuPanel.classList.add('hidden');
  menuOverlay.classList.add('hidden');
  menuToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
menuToggle.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', closeMenu);
document.querySelectorAll('[data-menu-cat]').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.menuCat;
    const chip = chipsEl.querySelector(\`[data-cat="\${CSS.escape(cat)}"]\`);
    if(chip) chip.click();
    closeMenu();
    document.getElementById('articleList').scrollIntoView({behavior:'smooth', block:'start'});
  });
});

const FS_KEY = 'paytaku-fontsize';
function applyFontSize(v){ document.documentElement.classList.toggle('large', v === 'large'); }
let fs = localStorage.getItem(FS_KEY) || 'normal';
applyFontSize(fs);
document.getElementById('fontToggle').addEventListener('click', () => {
  fs = fs === 'large' ? 'normal' : 'large';
  localStorage.setItem(FS_KEY, fs);
  applyFontSize(fs);
});

const THEME_KEY = 'paytaku-theme';
function applyTheme(v){
  document.documentElement.classList.toggle('dark', v === 'dark');
  document.getElementById('themeToggle').textContent = v === 'dark' ? '☀️' : '🌙';
}
let theme = localStorage.getItem(THEME_KEY) || 'light';
applyTheme(theme);
document.getElementById('themeToggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

render('すべて');
</script>
<script src="../assets/affiliates.js"></script>
</body>
</html>
`;
}


function escHtml(s){
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// 「お店から探す」の中身を、ビルド時に静的HTMLとして書き出す。
// JavaScriptを実行しないクローラー（AI Overviewなど多くのAI検索・要約エンジンを含む）にも
// 実際の店舗・カード・還元率の情報が読めるようにするための、いわゆる簡易プリレンダリング。
// クライアント側の renderStores() は起動時に #storeList の中身をまるごと作り直すため、
// ここで埋め込んだ静的HTMLは、JSが動く環境では一瞬で本来のインタラクティブな一覧に置き換わる
// （＝人間のユーザー体験は変えず、クローラー・低速回線・JS無効環境向けの土台を用意するだけ）。
function renderStoresStaticHtml(stores){
  const byCategory = new Map();
  stores.forEach(s => {
    if(!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category).push(s);
  });
  let html = "";
  byCategory.forEach((list, category) => {
    html += `<div class="store-category-label">${escHtml(category)}</div>\n`;
    list.forEach(store => {
      const cardsHtml = (store.cards || []).map(c =>
        `<li><strong>${escHtml(c.name)}</strong>：${escHtml(c.rate)}${c.method ? "（" + escHtml(c.method) + "）" : ""}</li>`
      ).join("");
      html += `<div class="store-card collapsed" data-static="1">`
        + `<div class="store-head"><div class="store-head-mid"><div class="store-name">${escHtml(store.name)}</div>`
        + `<div class="store-sub">${escHtml(store.category)}</div></div></div>`
        + `<ul class="store-static-cards">${cardsHtml}</ul>`
        + `</div>\n`;
    });
  });
  return html;
}

function main(){
  const articles = readArticles();
  const bySlug = new Map(articles.map(a => [a.slug, a]));

  mkdirSync(OUT_DIR, { recursive: true });

  const thumbHits = articles.filter(a => resolveThumbnail(a.slug, a.thumbnail)).length;
  console.log(`サムネイル画像: ${thumbHits}/${articles.length} 件を検出（assets/thumbnails/ + articles.json）`);

  articles.forEach(a => {
    if(!a.slug) throw new Error(`記事に slug がありません: ${a.title}`);
    // customHtml=true の記事は、標準テンプレートに収まらない診断・比較などの
    // 独立HTMLをリポジトリで直接管理している。上書きすると手作業の内容が消えるため、
    // ここではHTML生成をスキップし、記事一覧（index.html）にだけ載せる。
    if(a.customHtml){
      console.log(`skipped (customHtml): articles/${a.slug}.html`);
      return;
    }
    const html = articleTemplate(a, bySlug);
    writeFileSync(join(OUT_DIR, `${a.slug}.html`), html, "utf-8");
    console.log(`generated: articles/${a.slug}.html`);
  });

  writeFileSync(join(OUT_DIR, "index.html"), indexTemplate(articles), "utf-8");
  console.log(`generated: articles/index.html`);

  // sitemap.xml も記事一覧から自動生成する（記事を追加したら検索エンジンに拾われるように）
  writeFileSync(join(ROOT, "sitemap.xml"), sitemapXml(articles), "utf-8");
  console.log(`generated: sitemap.xml`);

  // index.html の「お店から探す」欄に、店舗データを静的HTMLとして埋め込む
  // （JSを実行しないクローラー・AI検索エンジン対策。詳細は renderStoresStaticHtml 参照）
  try{
    const storesPath = join(ROOT, "stores.json");
    if(existsSync(storesPath)){
      const stores = JSON.parse(readFileSync(storesPath, "utf-8"));
      const staticHtml = renderStoresStaticHtml(stores);
      const indexPath = join(ROOT, "index.html");
      let indexHtml = readFileSync(indexPath, "utf-8");
      const startMarker = "<!-- STATIC_STORES_START -->";
      const endMarker = "<!-- STATIC_STORES_END -->";
      const startIdx = indexHtml.indexOf(startMarker);
      const endIdx = indexHtml.indexOf(endMarker);
      if(startIdx === -1 || endIdx === -1){
        console.log("skipped: index.html に STATIC_STORES マーカーが見つかりません（未対応バージョンの可能性）");
      } else {
        indexHtml = indexHtml.slice(0, startIdx + startMarker.length) + "\n" + staticHtml + indexHtml.slice(endIdx);
        writeFileSync(indexPath, indexHtml, "utf-8");
        console.log(`generated: index.html の店舗一覧を静的プリレンダリング（${stores.length}件）`);
      }
    }
  } catch(e){
    console.log("警告: 店舗一覧の静的プリレンダリングに失敗しました:", e.message);
  }

  console.log(`\n合計 ${articles.length} 件の記事を生成しました。`);

  const brokenLinks = checkInternalLinks(articles);
  const unmonetizedLinks = checkAffiliateLinks();
  const staleContent = checkFreshness(90);
  writeHealthCheckJson({ brokenLinks, unmonetizedLinks, staleContent });
  writeAffKeysJson();

  if(process.argv.includes("--strict") && brokenLinks.length > 0){
    console.error("\n--strict指定のため、内部リンク切れがあるとビルドを失敗させます。");
    process.exit(1);
  }
}

// ========== 記事が実際に使っているdata-affキーの一覧を出力 ==========
// 管理画面で「カード追加」するとき、かな→ローマ字の自動キー生成が記事側の
// キー（英語スラッグ等）と一致せず、リンクが繋がらない事故が起きていた。
// これを恒久的に防ぐため、記事HTMLに実際に書かれているdata-affキーを
// ビルドのたびに自動でスキャンし、そのキー＋推定カード名を
// content/aff-keys.json として書き出す。管理画面はこれを読み込んで、
// 記事で使われているキーをそのまま候補として提示できるようにする
// （手入力によるキーの表記ゆれを無くすのが目的）。
function writeAffKeysJson(){
  const files = readdirSync(OUT_DIR).filter(
    f => f.endsWith(".html") && f !== "index.html" && !f.startsWith("_")
  );

  const found = new Map(); // key -> {name, articles: Set}
  files.forEach(file => {
    const content = readFileSync(join(OUT_DIR, file), "utf-8");

    // このファイル内でキー→推定カード名を拾うためのヒント。
    // 優先順位：nl-hero-name（カード名そのもの） > nl-cta-name（「〜を申し込む」から抽出）
    let heroName = null;
    const heroMatch = content.match(/<p class="nl-hero-name">([^<]+)<\/p>/);
    if(heroMatch) heroName = heroMatch[1].trim();

    let ctaName = null;
    const ctaMatch = content.match(/<p class="nl-cta-name">([^<]+)<\/p>/);
    if(ctaMatch) ctaName = ctaMatch[1].replace(/を(申し込む|始める|見る).*$/, "").trim();

    const guessedName = heroName || ctaName || null;

    const re = /data-aff="([^"]+)"/g;
    let m;
    while((m = re.exec(content))){
      const key = m[1];
      if(!found.has(key)) found.set(key, { name: guessedName, articles: new Set() });
      const entry = found.get(key);
      if(!entry.name && guessedName) entry.name = guessedName;
      entry.articles.add(file);
    }
  });

  const list = [...found.entries()].map(([key, v]) => ({
    key,
    name: v.name || key, // 名前を推定できなければキーをそのまま仮名にする
    articles: [...v.articles],
  })).sort((a, b) => a.key.localeCompare(b.key));

  writeFileSync(join(ROOT, "content", "aff-keys.json"), JSON.stringify(list, null, 2), "utf-8");
  console.log(`generated: content/aff-keys.json（記事内で使われているdata-affキー ${list.length} 件）`);
}

// ========== サイト運営の健全性チェック（結果をJSONにまとめて出力） ==========
// GitHub Actionsのログを見に行かなくても、ペイ択の編集モード内で直接警告を
// 表示できるように、チェック結果を content/health-check.json として書き出す。
// 編集モードをONにすると、scripts/app.js側がこのファイルを読み込んで
// 画面内にバナー表示する（renderHealthCheckBanner を参照）。
function writeHealthCheckJson({ brokenLinks, unmonetizedLinks, staleContent }){
  const data = {
    generatedAt: new Date().toISOString(),
    brokenLinks,
    unmonetizedLinks,
    staleContent,
  };
  writeFileSync(join(ROOT, "content", "health-check.json"), JSON.stringify(data, null, 2), "utf-8");
  const total = brokenLinks.length + unmonetizedLinks.length + staleContent.length;
  console.log(`\ngenerated: content/health-check.json（検出件数: 合計${total}件）`);
}

// ========== ①未収益化のアフィリエイトリンクチェック ==========
function checkAffiliateLinks(){
  const affiliatesPath = join(ROOT, "affiliates.json");
  let affiliates = { links: {} };
  try{ affiliates = JSON.parse(readFileSync(affiliatesPath, "utf-8")); }catch(e){ /* ファイルが無ければ空扱い */ }
  const knownKeys = new Set(Object.keys(affiliates.links || {}));

  const files = readdirSync(OUT_DIR).filter(
    f => f.endsWith(".html") && f !== "index.html" && !f.startsWith("_")
  );

  const problems = [];
  files.forEach(file => {
    const content = readFileSync(join(OUT_DIR, file), "utf-8");
    const re = /<a\s+data-aff="([^"]+)"\s+href="([^"]*)"/g;
    let m;
    const seen = new Set();
    while((m = re.exec(content))){
      const [, key, href] = m;
      if(seen.has(key)) continue;
      seen.add(key);
      if(knownKeys.has(key)) continue;

      let kind = "未登録（affiliates.jsonにキーが無い）";
      if(href === "#" || href === ""){
        kind = "未登録・href=#（完全にダミー）";
      } else if(/trafficgate\.net|accesstrade\.net|a8\.net|admane\.jp/.test(href)){
        kind = "未登録だがそれらしいURLが直書きされている（本物か要確認）";
      }
      problems.push({ file, key, href, kind });
    }
  });

  if(problems.length === 0){
    console.log(`✅ 未収益化のアフィリエイトリンクはありません。`);
  } else {
    console.log(`\n⚠️  未収益化のアフィリエイトリンクが ${problems.length} 件あります（content/health-check.jsonに記録）。`);
  }
  return problems;
}

// ========== ②確認日の鮮度チェック ==========
function checkFreshness(thresholdDays){
  const files = readdirSync(OUT_DIR).filter(
    f => f.endsWith(".html") && f !== "index.html" && !f.startsWith("_")
  );
  const today = new Date();
  const re = /確認日[：:]\s*(\d{4}-\d{2}-\d{2})/g;
  const stale = [];

  files.forEach(file => {
    const content = readFileSync(join(OUT_DIR, file), "utf-8");
    const datesInFile = new Set();
    let m;
    while((m = re.exec(content))){ datesInFile.add(m[1]); }
    datesInFile.forEach(date => {
      const d = new Date(date);
      if(Number.isNaN(d.getTime())) return;
      const days = Math.floor((today - d) / (1000 * 60 * 60 * 24));
      if(days >= thresholdDays){
        stale.push({ file, date, days });
      }
    });
  });

  if(stale.length === 0){
    console.log(`✅ ${thresholdDays}日を超えて古い確認日はありません。`);
  } else {
    console.log(`\n⚠️  確認日が${thresholdDays}日以上経過した記述が ${stale.length} 件あります（content/health-check.jsonに記録）。`);
  }
  return stale;
}

// ========== 内部リンク切れチェック ==========
// 記事同士の「あわせて読みたい」・本文中のリンク・ARTICLE_METAのrelated配列が
// 実在する記事を指しているかを、ビルドのたびに自動チェックする。
// 見つかったら警告を出す（ビルド自体は止めない。呼び出し元でproblemsを見て
// --strict指定時のみビルドを失敗させる）。
function checkInternalLinks(articles){
  const knownSlugs = new Set(articles.map(a => a.slug));
  const problems = []; // { file, kind, detail }

  const files = readdirSync(OUT_DIR).filter(
    f => f.endsWith(".html") && f !== "index.html" && !f.startsWith("_")
  );
  // 記事一覧（content/articles.json）には無いが、articles/フォルダに実在する
  // 静的HTML（about.html・privacy.html等）へのリンクは「壊れていない」とみなす。
  const existingFiles = new Set(files);

  files.forEach(file => {
    const path = join(OUT_DIR, file);
    const content = readFileSync(path, "utf-8");

    // href="./slug.html" 形式のリンクをチェック（index.htmlは記事一覧自体への正当なリンクなので除外）
    const hrefRe = /href="\.\/([a-zA-Z0-9_-]+)\.html"/g;
    let m;
    while((m = hrefRe.exec(content))){
      const slug = m[1];
      if(slug === "index") continue;
      if(knownSlugs.has(slug)) continue;
      if(existingFiles.has(`${slug}.html`)) continue; // 実ファイルとして存在すればOK
      problems.push({ file, kind: "リンク切れ", detail: `./${slug}.html` });
    }

    // ARTICLE_META内のrelated配列もチェック（こちらは記事一覧に載る前提の項目なので、
    // content/articles.jsonのslugと厳密に一致している必要がある）
    const metaMatch = content.match(/<!--ARTICLE_META\s*(\{[\s\S]*?\})\s*ARTICLE_META-->/);
    if(metaMatch){
      try{
        const meta = JSON.parse(metaMatch[1]);
        (meta.related || []).forEach(slug => {
          if(!knownSlugs.has(slug)){
            problems.push({ file, kind: "ARTICLE_META related切れ", detail: slug });
          }
        });
      }catch(e){ /* JSONとして壊れている場合は別の問題なのでここでは無視 */ }
    }
  });

  if(problems.length === 0){
    console.log(`✅ 内部リンク切れはありません（${files.length}件チェック済み）。`);
    return problems;
  }

  console.log(`\n⚠️  内部リンクの問題が ${problems.length} 件見つかりました：`);
  const byFile = {};
  problems.forEach(p => { byFile[p.file] = byFile[p.file] || []; byFile[p.file].push(p); });
  Object.entries(byFile).forEach(([file, list]) => {
    console.log(`  ${file}`);
    list.forEach(p => console.log(`    - [${p.kind}] ${p.detail}`));
  });

  return problems;
}

// 記事一覧（content/articles.json）には含まれない、固定の静的ページ。
// index.html内のLP（DMM株・au PAYマーケット・小田急ポイントカード・about・privacy）を
// 個別クロール可能な静的ページとして書き出したもの。
// ここに追加しておけば、記事を追加するたびのsitemap再生成でも消えずに残る。
const STATIC_PAGES = [
  { path: "pages/kabu-koza.html", pri: "0.5", freq: "monthly" },
  { path: "pages/nettsuuhan.html", pri: "0.5", freq: "monthly" },
  { path: "pages/odakyu-point.html", pri: "0.5", freq: "monthly" },
  { path: "pages/about.html", pri: "0.3", freq: "yearly" },
  { path: "pages/privacy.html", pri: "0.3", freq: "yearly" },
];

function sitemapXml(articles){
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  const push = (loc, freq, pri, lastmod) => {
    rows.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>`);
  };
  push(`${SITE_URL}/`, "weekly", "1.0", today);
  push(`${SITE_URL}/articles/`, "weekly", "0.8", today);
  articles.forEach(a => {
    const lastmod = a.updatedDate || a.publishedDate || today;
    push(`${SITE_URL}/articles/${a.slug}.html`, "monthly", "0.7", lastmod);
  });
  STATIC_PAGES.forEach(p => {
    push(`${SITE_URL}/${p.path}`, p.freq, p.pri, today);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join("\n")}
</urlset>
`;
}

main();
