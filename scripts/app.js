
window.GA_MEASUREMENT_ID = "https://paytaku-ai-import.ayana16371212.workers.dev"; // ← ここにG-XXXXXXXXXXを入れると有効化
if(window.GA_MEASUREMENT_ID){
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + window.GA_MEASUREMENT_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", window.GA_MEASUREMENT_ID);
}

// ========== AIキャンペーン取り込み：中継サーバーの設定 ==========
// AI（Google Gemini API）のキーはブラウザに直接書けない（誰でも盗めてしまう）ため、
// キーを安全に保持する小さな中継サーバー（Cloudflare Workers）を別途デプロイし、
// そのURLをここに入れる。Gemini APIはクレジットカード登録なしの無料枠がある。
// デプロイ方法は cloudflare-worker/README.md を参照。
// 空のままだと「✨ リンクから取り込む」は「設定が必要です」という案内を出すだけになる。
window.AI_IMPORT_ENDPOINT = "https://silent-scene-2981.ayana16371212.workers.dev"; // ← 例: "https://paytaku-ai-import.your-name.workers.dev"
// アフィリエイトリンクのクリック計測（GA4のイベント形式で送信）
document.addEventListener("click", function(e){
  var link = e.target.closest("a[href*='a8.net'], a[href*='accesstrade.net']");
  if(link && window.gtag){
    var url = link.href;
    var product = url.includes("15QHIA") || url.includes("15P77L") || url.includes("15Q22P") ? "dmm_kabu" :
                  url.includes("61JSH") || url.includes("62U35") ? "aupay_market" :
                  url.includes("ox3w") ? "odakyu_point" : "other";
    gtag("event", "affiliate_click", {
      product: product,
      location: link.closest(".lp-page") ? "lp" :
                link.closest(".featured-wrap") ? "featured_banner" :
                link.closest(".affiliate-section") ? "in_tab" : "other"
    });
  }
});



// ========== アフィリエイトリンク ==========
// カード名ごとに1件登録すると、そのカードが出てくる全タブ（お店・決済アプリ・
// クレカ積立・チャージルート）の該当箇所に自動で「申し込み」ボタンが並ぶ。
// stores.json とは別キーで保存するので、店舗データを更新しても消えない。
const AFFILIATE_KEY = "kangenchou_affiliates";
const AFFILIATES_JSON_PATH = "affiliates.json"; // GitHubに置く公開用ファイル

function loadAffiliates(){
  try{
    const raw = localStorage.getItem(AFFILIATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveAffiliates(){
  try{ localStorage.setItem(AFFILIATE_KEY, JSON.stringify(affiliates)); } catch {}
}

// エイリアス解決：admin/affiliates.html で「他のカードとリンクを共有する」に設定したカードは
// links[key] = {type:'alias', aliasOf:'otherKey'} という形で保存されている。参照先のURL・バナーを
// そのまま使うことで、参照先を更新するとこのカードにも自動で反映される。
// （2段階以上のエイリアス連鎖は想定しておらず、参照先自体がさらにエイリアスの場合は解決しない）
function resolveAffiliateAliases(data){
  if(!data || !data.links) return;
  const links = data.links, banners = data.banners || (data.banners = {});
  Object.keys(links).forEach(k => {
    const l = links[k];
    if(l && l.type === "alias" && l.aliasOf && links[l.aliasOf]){
      links[k] = links[l.aliasOf];
      if(!banners[k] && banners[l.aliasOf]) banners[k] = banners[l.aliasOf];
    }
  });
}

let affiliates = loadAffiliates();
resolveAffiliateAliases(affiliates);

// admin/affiliates.html の CARDS 配列のデフォルトと対応させたスラッグ→カード名の対応表。
// 本来は affiliates.json 自体に含まれる "names" を優先して使うが、
// まだ古い形式のまま（namesを含まない）のファイルが公開されている間の
// フォールバックとして、この一覧も残しておく。
const AFFILIATE_SLUG_FALLBACK_NAMES = {
  "rakuten-card": "楽天カード",
  "rakuten-premium": "楽天プレミアムカード",
  "dcard-gold": "dカード GOLD",
  "dcard-goldu": "dカード GOLD U",
  "dcard-platinum": "dカード PLATINUM",
  "jcb-card-w": "JCB CARD W",
  "epos-card": "エポスカード",
  "smbc-nl": "三井住友カード（NL）",
  "dmm-kabu": "DMM 株",
  "aupay-market": "au PAYマーケット",
  "odakyu-op": "小田急ポイントカード（OPクレジット）",
};

// キー完全一致でアフィリリンクを引く（記事のdata-affと同じ考え方）。
// ルート側に affKey を明示しておけば、あいまいな名前一致より確実に狙った
// リンクが採用される。affKey が無い/該当が無い場合は呼び出し側で
// 従来のaffiliateFor（名前のあいまい一致）にフォールバックする。
// 「お店から探す」リストの合間に挟むPR枠。admin/affiliates.html の管理画面で
// 実際にリンクが設定されている案件だけが表示され、未設定のものは自動でスキップされる。
// affKey は affiliates.json のキーと一致させること（"category-store" を模した一覧表示）。
const STORE_AD_SLOTS = [
  { kind: "card", affKey: "rakuten-card", name: "楽天カード", tagline: "年会費無料・還元率1.0%〜", articleUrl: "articles/rakuten-card-shindan.html" },
  { kind: "card", affKey: "jcb-card-w", name: "JCB CARD W", tagline: "39歳までの申込みで年会費永年無料", articleUrl: "articles/jcb-card-w-shindan.html" },
  { kind: "card", affKey: "smbc-nl", name: "三井住友カード（NL）", tagline: "対象コンビニ・飲食店でタッチ決済7%還元", articleUrl: "articles/smbc-nl-shindan.html" },
  { kind: "card", affKey: "epos-card", name: "エポスカード", tagline: "年会費無料・海外旅行保険と優待が強い1枚", articleUrl: "articles/epos-card-shindan.html" },
  { kind: "pointsite", affKey: "hapitas-signup", name: "ハピタス", tagline: "買い物・カード発行の前に経由するだけでポイント上乗せ", articleUrl: "articles/hapitas-shindan.html" },
  { kind: "pointsite", affKey: "moppy-signup", name: "モッピー", tagline: "1P=1円、会員1,300万人超のポイントサイト", articleUrl: "articles/moppy-shindan.html" },
];

function affiliateForKey(key){
  if(!key) return null;
  const links = (affiliates && affiliates.links) || {};
  const entry = links[key];
  if(!entry) return null;
  return typeof entry === "string" ? entry : (entry.url || null);
}

// カード名（複数可）から該当するアフィリリンクを引く。affiliates.json の links は
// { スラッグ: {type,url,via} } という形（キーはカード名そのものではない）なので、
// names（無ければ上のフォールバック表）でスラッグ→カード名に変換してから、
// 部分一致で照合する。より具体的な（長い）カード名を優先する。
// candidateNames には「実際にそのルートの起点になり得るカード名の一覧」を渡すこと
// （ルートの説明文全体ではなく）。説明文全体を渡すと、途中の経由地・目的地の
// サービス名まで拾って誤爆することがあるため。
// ⚠️ これでも複数の登録名が候補に含まれると、意図しない方が採用されることがある。
// 確実に紐づけたい場合は、ルート側に affKey を設定して affiliateForKey を使うこと。
function affiliateFor(candidateNames){
  if(!candidateNames) return null;
  const names_ = Array.isArray(candidateNames) ? candidateNames : [candidateNames];
  if(names_.length === 0) return null;
  const links = (affiliates && affiliates.links) || {};
  const names = (affiliates && affiliates.names) || {};

  let best = null, bestLen = -1;
  names_.forEach(cardName => {
    if(!cardName) return;
    const shortName = cardName.split("（")[0];
    Object.keys(links).forEach(slug => {
      const entry = links[slug];
      const url = entry && (typeof entry === "string" ? entry : entry.url);
      if(!url) return;
      const name = names[slug] || AFFILIATE_SLUG_FALLBACK_NAMES[slug] || slug;
      const matches = cardName.includes(name) || name.includes(cardName) || cardName.includes(name.split("（")[0]) || name.includes(shortName);
      if(matches && name.length > bestLen){
        best = url;
        bestLen = name.length;
      }
    });
  });
  return best;
}

// 「公式」＋「申し込み」を並べたリンク列を返す。
// affKey が指定されていれば完全一致（affiliateForKey）を最優先し、
// 無ければ starters（実際の起点カード名一覧）で安全側のあいまい一致にフォールバックする。
function linkRowHtml(officialUrl, cardName, articleUrl, affKey, starters){
  const candidateNames = starters ? Object.keys(starters) : [cardName];
  const aff = (affKey && affiliateForKey(affKey)) || affiliateFor(candidateNames);
  const parts = [];
  // articleUrl/officialUrl はAI取り込みや手動編集で入る可能性がある外部由来の値なので、
  // href属性に入れる前にスキームを検証（http/https以外は表示しない）し、エスケープする。
  if(articleUrl && isSafeHttpUrl(articleUrl)){
    parts.push(`<a class="src-link" href="${escapeAttr(articleUrl)}">詳しく解説 →</a>`);
  }
  if(officialUrl && isSafeHttpUrl(officialUrl)){
    parts.push(`<a class="src-link" href="${escapeAttr(officialUrl)}" target="_blank" rel="noopener noreferrer">公式 ↗</a>`);
  }
  if(aff && isSafeHttpUrl(aff)){
    parts.push(`<a class="src-link apply-link" href="${escapeAttr(aff)}" target="_blank" rel="sponsored noopener noreferrer">申し込み ↗</a>`);
  }
  return parts.length ? `<div class="link-row">${parts.join("")}</div>` : "";
}



// ========== 店舗から探す（β） ==========
// 各社の還元プログラムの「事実」（対象カード・還元率・支払い方法の条件）を
// 自分の言葉でまとめたデータです。出典サイトの文章をそのまま複製せず、
// 条件を要約し直しています。
//
// [追加・修正のしかた]
// これはあくまで「初期データ（工場出荷時の状態）」です。実際に画面に表示
// されるデータは、下の loadStores() でこの初期データをこの端末のブラウザ
// （localStorage）にコピーしたものを使います。編集モードでサイト上から
// 追加・編集・削除すると、そちらのコピーだけが更新されます。
//
// 各エントリーの note には「確認日」を残しています。還元率・条件はよく
// 変わるので、日付が古くなってきたら再確認をお願いすることがあります。
// 参照元サイトのジャンル分けに合わせた固定カテゴリ一覧。
// 新しいお店を追加するときは、必ずこの中から選ぶ形にしている。
const CATEGORY_LIST = [
  "コンビニ", "飲食店（すべて）", "ファストフード", "牛丼・定食", "ファミレス", "回転寿司", "飲食店（その他）",
  "カフェ", "スーパー", "ドラッグストア", "自販機", "エンタメ", "トラベル",
  "ホームセンター", "ファッション", "ネット通販", "交通", "その他"
];

// 「飲食店（すべて）」は親カテゴリ。カテゴリ絞り込みで選んだとき、
// 飲食系のサブカテゴリすべてを含めて表示する。
const FOOD_SUBCATEGORIES = ["ファストフード", "牛丼・定食", "ファミレス", "回転寿司", "飲食店（その他）", "カフェ"];
function matchesCategory(storeCategory, filterCategory){
  if(filterCategory === "all") return true;
  if(filterCategory === "飲食店（すべて）") return FOOD_SUBCATEGORIES.includes(storeCategory);
  return storeCategory === filterCategory;
}

// スマホ決済（PayPay・楽天ペイなど）は「どの加盟店でも同じ還元率」が基本なので、
// 店舗データ側には重複して持たせず、ここに一元管理する。
// 表示するときは各店舗のカード一覧に合流させ、クレカと同じ土俵で並べ替える。
// これにより「この店ならクレカとスマホ決済のどっちが得か」がその場で分かる。
// 店舗限定のキャンペーン（例：スシローのauPAY 10%）は従来どおり STORES 側に入れる。
// ========== チャージルート ==========
// クレカ→プリペイド→残高…と経由させ、各段階の還元を積み上げる方法。
// steps は経由順、gains は「どこで何%付くか」の内訳。
// このジャンルは各社の規約変更で頻繁に塞がれるため、確認日を必ず残す。
// ========== 今月の優先決済 ==========
// 「今月はこれで払うのが一番おトク」という、期間限定の決済手段そのものの特典。
// 店舗別のキャンペーンとは別枠で、月初の判断材料として一番上に出す。
// stores.json と同じく、これは初期データ。実際の表示は picks.json →
// localStorage → この初期値、の順で読み込む。
const DEFAULT_PICKS = [
  {
    "slug": "touch-norisha-10-5",
    "name": "クレカのタッチ決済で乗車 最大10.5%（常設）",
    "rate": "JCB 10.5%／三井住友 8%",
    "period": "常設（JCBは2027/5/15まで）",
    "how": [
      "【JCB（最大10.5%）】J-POINTパートナーで事前にポイントアップ登録する",
      "JCBカード本体、またはJCBを設定したスマホを改札にかざす（カード現物でも対象）",
      "【三井住友（最大8%）】Apple Pay / Google Payに登録し、必ずスマホをかざす（カード現物は対象外）"
    ],
    "note": "還元率はJCBの方が高く、JCB CARD W / W plus L / Biz ONE なら10.5%、その他のJCBオリジナルシリーズで10%。全国約190事業者で、電車・バス・フェリー・ロープウェイまで対象です。三井住友カードは最大8%ですが、対象がスマホのタッチ決済に限られます。【両者共通】JRは対象外なので、JR区間はICOCA・Suicaを使う方がおトクです。［確認日: 2026-08-09］",
    "url": "https://j-pointpartner.jcb.co.jp/"
  },
  {
    "slug": "vpoint-pay-yusen-10",
    "name": "VポイントPay ポイント優先払いで10%還元",
    "rate": "10%還元",
    "period": "8/1〜8/31",
    "expires": "2026-08-31",
    "how": [
      "キャンペーンページからエントリーする",
      "VポイントPayアプリとVポイントを連携（ID連携）する",
      "アプリで「ポイントで支払う」をONにする",
      "店頭で「Visaで」または「クレジットカードで」と伝え、スマホのタッチ決済で合計500円（税込）以上使う"
    ],
    "note": "上限500ポイント（＝5,000円分の利用で上限）。付与は2026年11月末頃、本会員1人につき1回まで。【対象外に注意】iD払いは対象外で、セルフレジで「Apple Pay」ボタンを選ぶとiDになってしまうため、必ず「クレジットカード」を選ぶこと。バーコード決済アプリ経由・ネットショッピング・配達サービスも対象外。原則1万円を超えるとタッチ決済自体ができない場合がある。Oliveの「ポイント払いモード」でのスマホタッチ決済も対象。［確認日: 2026-08-09／出典: 三井住友カード公式・Vポイントサイト］",
    "url": "https://www.smbc-card.com/mem/cardinfo/26/cardinfo7244745.jsp"
  },
  {
    "slug": "vcoupon-multi-shop-500pt",
    "name": "Vクーポン 複数ショップ利用で最大500ポイント",
    "rate": "最大500pt上乗せ",
    "period": "8/1〜9/30",
    "expires": "2026-09-30",
    "how": [
      "キャンペーンにエントリーする",
      "Vクーポンを複数の対象ショップで使う"
    ],
    "note": "下の店舗別Vクーポンと併用できる、いわば「はしご」ボーナス。1店舗で終わらせず複数店で使うほど有利になる。［確認日: 2026-08-09］",
    "url": "https://www.smbc-card.com/camp/vcoupon/index.jsp"
  },
  {
    "slug": "natsu-coupon-matsuri",
    "name": "夏のクーポン祭り（Vクーポン × Vポイントアプリ）",
    "rate": "2種類のクーポンを重ね取り",
    "period": "8/1〜9/30",
    "expires": "2026-09-30",
    "how": [
      "三井住友カードの「Vクーポン」を事前に獲得しておく",
      "Vポイントアプリの「Vカードクーポン」もセットしておく",
      "会計時にモバイルVカードを提示し、そのうえで三井住友カードで決済する"
    ],
    "note": "提示と決済で別々のクーポンが効くため、両方セットしておくと特典が重なる。Vポイントアプリを初めて使う人／久しぶりの人には30ptがもらえるクーポンも配信中。［確認日: 2026-08-09］",
    "url": "https://www.vpoint.net/scm1"
  },
  {
    "slug": "jichitai-campaign",
    "name": "自治体キャンペーン（地域限定の高還元）",
    "rate": "最大10〜30%還元",
    "period": "地域ごとに異なる",
    "expires": "2026-09-30",
    "how": [
      "自分の住む地域・出かける先で実施中のキャンペーンを確認する",
      "対象の決済アプリ（PayPay・d払い・au PAY・楽天ペイなど）を用意する",
      "対象店舗で決済する（多くは事前エントリー不要）"
    ],
    "note": "自治体とスマホ決済各社が連携した還元事業で、還元率が突出して高いのが特徴。多くは在住・在勤を問わず観光客も対象で、事前エントリーも不要。ただし予算上限に達すると期間内でも早期終了するため、使う予定があるなら期間の前半に済ませるのが確実。【8月時点の主な例】千葉県全域 最大10%（千葉市はさらに+5%で最大15%／8/7〜8/30）、岩手県全域 最大20%（8/17〜9/18）、神奈川県 中小店舗20%・大手10%、岐阜市20%、秋田県湯沢市10%（9/30まで）。【大阪府内】松原市がPayPayで最大20%還元を8/1から実施中。また府内16市でプレミアム付商品券が展開されており、大阪市30%（1万円→1.3万円分、利用は2027/1/15まで）、堺市50%、門真市50%、吹田市40%、池田市40%など。商品券は申込期限があるため各市の公式サイトで確認を。実施地域は毎月入れ替わるので、最新情報は各決済アプリ内および自治体の公式サイトで確認してください。［確認日: 2026-08-09／出典: ITmedia・各自治体発表］",
    "url": "https://paypay.ne.jp/event/"
  },
  {
    "slug": "dpoint-koukan-zouryo",
    "name": "dポイント交換 最大15%増量キャンペーン",
    "rate": "もれなく8% ＋ 抽選7%",
    "period": "8/1〜8/31",
    "expires": "2026-08-31",
    "how": [
      "キャンペーンページからエントリーする（交換後でも期間内ならOKだが早めに）",
      "対象の他社ポイント（Pontaポイント、ポイントサイトのポイントなど）をdポイントへ交換する",
      "交換した合計額に対して8%が期間限定ポイントで付与される"
    ],
    "note": "買い物をしなくても、持っているポイントを交換するだけで増えるのが特徴。ポイントサイトを使っている人には交換の絶好機。【注意】元の交換レートが100%でないポイントは目減りするため要確認（例：永久不滅ポイントはdポイントへ90%＝1P→4.5Pなので直接交換は不利。他社ポイントを経由すればほぼ100%で交換できる）。付与されるのは期間限定ポイントなので、使い道を決めてから交換すること。なお2026年夏は例年より増量レートが低めという評価もある。［確認日: 2026-08-09／出典: dポイント公式・比較メディア複数］",
    "url": "https://dpoint.docomo.ne.jp/campaign/index.html"
  }
];

// ---------- 今月の優先決済：読み込みと保存 ----------
const PICKS_KEY = "kangenchou_picks";
const PICKS_JSON_PATH = "picks.json";

// slugを持たない古いデータ（picks.jsonやlocalStorageの旧キャッシュ）が来た場合に、
// DEFAULT_PICKSの同名項目からslugを補い、それも無ければ名前から安定的に生成する。
function hashCode(str){
  let h = 0;
  for(let i = 0; i < str.length; i++){
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}
function slugifyPickName(name, i){
  const base = String(name || `pick-${i}`);
  return "pick-" + Math.abs(hashCode(base)).toString(36);
}
function ensurePickSlugs(list){
  return (list || []).map((p, i) => {
    if(p && p.slug) return p;
    const def = DEFAULT_PICKS.find(d => d.name === (p && p.name));
    const slug = (def && def.slug) || slugifyPickName(p && p.name, i);
    return Object.assign({}, p, { slug });
  });
}

function loadPicks(){
  try{
    const raw = localStorage.getItem(PICKS_KEY);
    if(raw){
      const p = JSON.parse(raw);
      if(Array.isArray(p)) return ensurePickSlugs(p);
    }
  } catch {}
  return ensurePickSlugs(JSON.parse(JSON.stringify(DEFAULT_PICKS)));
}
function savePicks(){
  try{ localStorage.setItem(PICKS_KEY, JSON.stringify(MONTHLY_PICKS)); } catch {}
}
function persistPicks(){
  savePicks();
  pushJsonToGithub(PICKS_JSON_PATH, MONTHLY_PICKS, "今月の優先決済");
}

let MONTHLY_PICKS = loadPicks();

// ========== 今月のおすすめカード（アフィリエイトバナー） ==========
// 編集モードで直接編集する。月1回更新するだけでキャンペーンタブの上部に反映される。
// affiliate は affiliates.json の紹介リンク管理に登録したカード名と一致させる。
// 「今月のおすすめ」バナー。affiliate プロパティを持つものはアフィリエイト提携中のもの、
// card プロパティはCARD_PICKSにあるカード名を参照する用（今後の提携拡大時に使う）。
const FEATURED_CARDS = [
  {
    affiliate: "dmm",  // #/kabu-koza の LP に飛ぶアフィリエイト案件
    name: "DMM 株",
    card: "DMM 株", // admin/affiliates.html の管理画面で設定したリンクをここから引く
    headline: "手数料が業界最安水準の株口座",
    reason: "クレカ積立を始めるならまず口座も必要。DMM 株はスマホ完結・最短即日開設。SBI証券やマネックス証券でのクレカ積立と併用しやすい。※株式投資には元本割れリスクがあります。",
    badge: "PR｜提携中",
    badgeColor: "#C8701A",
    articleUrl: "articles/dmm-kabu-shindan.html", // 詳細を見る＝この解説記事に飛ばす
    lpHash: "#/kabu-koza",
    directUrl: "https://px.a8.net/svt/ejp?a8mat=4BA41D+C7ZCTU+1WP2+15QHIA", // 管理画面が未設定のときのフォールバック
    trackingPixel: "https://www11.a8.net/0.gif?a8mat=4BA41D+C7ZCTU+1WP2+15QHIA"
  },
  {
    affiliate: "aupay-market",
    name: "au PAYマーケット",
    card: "au PAYマーケット", // admin/affiliates.html の管理画面で設定したリンクをここから引く
    headline: "貯めたポイントの使い道",
    reason: "チャージルートで貯めたPontaポイント・au PAY残高をそのまま使えるネット通販。対象ショップならポイントアップで実質的な二重取り。",
    badge: "PR｜提携中",
    badgeColor: "#1A6EC8",
    lpHash: "#/nettsuuhan",
    directUrl: "https://px.a8.net/svt/ejp?a8mat=4BA41D+FG2VSI+54O2+62U35", // 管理画面が未設定のときのフォールバック
    trackingPixel: "https://www12.a8.net/0.gif?a8mat=4BA41D+FG2VSI+54O2+62U35"
  },
  {
    affiliate: "odakyu",
    name: "小田急ポイントカード（OPクレジット）",
    card: "小田急ポイントカード（OPクレジット）", // admin/affiliates.html の管理画面で設定したリンクをここから引く
    headline: "小田急沿線で最大10%還元",
    reason: "小田急百貨店で最大10%、Odakyu OXで5%OFF、PASMOオートチャージ対応。年会費は実質無料。小田急線沿線で暮らす人に。",
    badge: "PR｜提携中",
    badgeColor: "#0066B3",
    articleUrl: "articles/odakyu-point-card-shindan.html", // 詳細を見る＝この解説記事に飛ばす
    lpHash: "#/odakyu-point",
    directUrl: "https://h.accesstrade.net/sp/cc?rk=0100kw0d00ox3w" // 管理画面が未設定のときのフォールバック
  }
];

function renderFeaturedCards(){
  const el = document.getElementById("featuredCardBanner");
  if(!el) return;
  if(!FEATURED_CARDS.length){ el.innerHTML = ""; return; }

  el.innerHTML = `
    <div class="featured-wrap">
      <div class="featured-label">💳 今月のおすすめ</div>
      <div class="featured-scroll">
        ${FEATURED_CARDS.map(f => {
          const aff = (f.card ? affiliateFor(f.card) : null) || f.directUrl || null;
          const displayName = f.name || f.card;
          return `
            <div class="featured-card">
              <div class="featured-badge" style="background:${f.badgeColor}">${f.badge}</div>
              <div class="featured-name">${displayName}</div>
              <div class="featured-headline">${f.headline}</div>
              <div class="featured-reason">${f.reason}</div>
              <div class="featured-actions">
                ${f.articleUrl ? `<a class="featured-detail-btn" href="${f.articleUrl}" style="text-decoration:none;display:block;">詳細を見る（解説記事）</a>` : ""}
                ${f.lpHash ? `<a class="featured-detail-btn" href="${f.lpHash}" style="text-decoration:none;display:block;">PRページを見る</a>` : (!f.articleUrl && f.card ? `<button class="featured-detail-btn" data-card="${f.card}">このカードの詳細を見る</button>` : "")}
                ${aff ? `<a class="featured-apply-btn" href="${aff}" target="_blank" rel="sponsored nofollow noopener noreferrer">申し込む（PR） ↗</a>` : ""}
              </div>
              ${f.trackingPixel ? `<img border="0" width="1" height="1" src="${f.trackingPixel}" alt="" style="position:absolute;visibility:hidden;">` : ""}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  el.querySelectorAll(".featured-detail-btn[data-card]").forEach(btn => {
    btn.addEventListener("click", ()=> openCardDetailModal(btn.dataset.card));
  });
}

// 公開されているpicks.jsonがあれば、そちらを正とする
async function refreshPicksFromGithubPages(){
  try{
    const res = await fetch(`${PICKS_JSON_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if(!res.ok) return;
    const data = await res.json();
    if(Array.isArray(data)){
      MONTHLY_PICKS = ensurePickSlugs(data);
      savePicks();
      renderPicks();
      renderCampaigns();
    }
  } catch(e){
    console.info("picks.json の取得をスキップしました", e.message);
  }
}


// ========== カード選び ==========
// 「どの店で何%か」ではなく「どのカードを持つべきか」に答えるデータ。
// 用途（土台／チャージ起点／デビット）ごとに分けて、選ぶ基準を示す。
const CARD_PICKS = [
  {
    group: "土台の1枚（どこでも安定して高還元）",
    items: [
      {
        name: "リクルートカード",
        rate: "1.2%",
        fee: "年会費永年無料",
        why: "特約店を気にせず、どこで使っても1.2%。年会費無料カードでは最高水準の基本還元率。",
        cons: "貯まるリクルートポイントの使い道はじゃらん・ホットペッパーなど限定的。Pontaやdポイントへ交換は可能だが1ステップ挟む。電子マネーチャージのポイントに月間上限あり。",
        detail: "公共料金や携帯料金の支払いでも1.2%が付くのが強み（多くのカードは公共料金だと還元率が下がる）。貯まるリクルートポイントはPontaポイント・dポイントへ1:1で交換でき、じゃらん・ホットペッパーでも使える。Amazonでもリクルートポイントが使えるようになった。JCBブランドならETCカードの発行・年会費が無料（Visa/Mastercardは発行手数料あり）。電子マネーチャージでもポイントが付くが、月間の付与上限がある。［確認日: 2026-08-09］",
        good: "チャージルートが面倒／特約店を覚えたくない人",
        url: "https://recruit-card.jp/"
      },
      {
        name: "JCB CARD W",
        rate: "最大10.5%（基本1.0%）",
        fee: "年会費永年無料",
        why: "基本1.0%に加え、J-POINTパートナーの優待店で大きく跳ねる。クレカ乗車10.5%も強力。",
        cons: "申込は39歳まで限定（40歳以降の新規申込不可）。J-POINTパートナーの優待は店舗ごとに事前登録が必要で、登録していない店では1.0%。JCBは海外・一部ネットショップで使えない加盟店がある。",
        detail: "【申込条件】18〜39歳限定。ただし39歳までに入会すれば40歳以降も年会費無料のまま使い続けられる（40歳以降の新規申込は不可）。■【ポイントの仕組み】JCBのポイントは2026年1月にOki Dokiポイントから「J-POINT」へ移行し、1ポイント=1円で使えるようになった。貯まり方は3階建てで、①通常ポイント（基本0.5%）②J-POINTパートナー（登録した対象店で最大10%）③J-POINTボーナス（年間50万円達成ごとにボーナス）。■【W会員の優遇】JCB CARD W / W plus L / Biz ONE は常時+1倍が加算されるため、同じ店でも他のオリジナルシリーズより1段高くなる。クレカ乗車なら10%→10.5%、Amazonなら3倍→実質2%相当。■【最も間違えやすい点】J-POINTパートナーの優待は、店舗ごとに事前のポイントアップ登録（無料）をしないと倍率が上がらない。多くは初回1度きりで以降は不要だが、登録していない店では通常ポイントしか付かない。2026年からは従来の「MyJチェック登録」は倍率に関係しなくなり、ポイントアップ登録だけで完結する方式に変わった。［確認日: 2026-08-09］",
        good: "39歳以下／外食・コンビニ・交通の利用が多い人",
        url: "https://j-pointpartner.jcb.co.jp/"
      },
      {
        name: "楽天カード",
        rate: "1.0%（楽天市場で3.0%以上）",
        fee: "年会費永年無料",
        why: "どこでも1.0%。楽天市場を使うなら3.0%以上になり、貯まったポイントの使い道も広い。",
        cons: "SPUの条件は頻繁に改定されるため、過去の還元率が維持されない。楽天市場以外では還元率が平凡。楽天グループのサービスを使わない人はメリットが薄い。",
        detail: "国内で最も保有者が多いカードのひとつ。楽天ポイントは楽天グループだけでなく、楽天ポイントカード加盟店でも1ポイント1円で使え、支払いにも投資にも回せる。SPUで楽天銀行・楽天証券などを組み合わせると倍率が上がるが、SPUの条件は頻繁に改定されるため過信は禁物。楽天ペイと組み合わせると街の店でも還元を重ねられる。［確認日: 2026-08-09］",
        good: "楽天市場をよく使う人／ポイントの使い道を重視する人",
        url: "https://www.rakuten-card.co.jp/",
        // TG-Affiliate（券面画像バナー）。バナーコードは規約により変更禁止。
        cardImageUrl: "https://srv2.trafficgate.net/t/b/519/1396/318860_398517",
        cardImageLink: "https://ad2.trafficgate.net/t/r/519/1396/318860_398517"
      },
      {
        name: "三井住友カード（NL）/ Olive",
        rate: "0.5%（対象店で7〜8%）",
        fee: "年会費永年無料",
        why: "基本還元率は低いが、対象のコンビニ・飲食店でのスマホタッチ決済が突出して強い。",
        cons: "基本還元率が0.5%と低く、対象店以外ではメリットが薄い。スマホのタッチ決済限定で、カード現物のタッチ・iD・差し込み・磁気は対象外。最大還元率には「セブン-イレブンアプリの提示」など条件達成が必要。1万円超の会計は対象外になる場合あり。",
        detail: "基本0.5%なので「土台」としては弱く、対象店専用の1枚と考えるのが正しい。リクルートカードなど基本還元率の高いカードと2枚持ちするのが定石。カード現物のタッチ決済は対象外で、必ずスマホをかざす必要がある。［確認日: 2026-08-09］",
        good: "コンビニ・対象飲食店をよく使う人（2枚目として）",
        url: "https://www.smbc-card.com/"
      }
    ]
  },
  {
    group: "ゴールド以上（年会費を払う価値があるか）",
    items: [
      {
        name: "楽天プレミアムカード",
        rate: "1.0%（楽天市場で3.0%以上／プライオリティ・パス付帯）",
        fee: "11,000円",
        why: "楽天カードの上位版。国内・海外の空港ラウンジが無料で使えるプライオリティ・パスが付帯し、旅行保険も手厚い。",
        cons: "年会費11,000円は還元率だけで元を取るのは難しく、ラウンジや旅行保険をどれだけ使うかが価値を左右する。SPUの上乗せ倍率は改定されやすい。海外利用時のポイント優遇は条件付き。",
        detail: "楽天カードとの最大の違いはプライオリティ・パス（無料でラウンジが使い放題）と旅行傷害保険の手厚さ。年会費11,000円だが、空港ラウンジやホテルの優待を使う人にはコストパフォーマンスが高い。楽天市場でのSPU倍率は通常の楽天カードと同様に加算され、あわせて3.0%以上を狙える。［確認日: 2026-08-12］",
        good: "空港ラウンジをよく使う人／旅行の頻度が高い人",
        url: "https://www.rakuten-card.co.jp/premiumcard/",
        // TG-Affiliate（プレミアム／券面画像）。バナーコードは規約により変更禁止。
        affiliateBannerUrl: "https://srv2.trafficgate.net/t/b/497/1396/318860_398517",
        affiliateBannerLink: "https://ad2.trafficgate.net/t/r/497/1396/318860_398517",
        cardImageUrl: "https://srv2.trafficgate.net/t/b/298/1396/318860_398517",
        cardImageLink: "https://ad2.trafficgate.net/t/r/298/1396/318860_398517"
      },
      {
        name: "三井住友カード ゴールド（NL）",
        rate: "0.5%（対象店7〜8%）",
        fee: "5,500円 → 年100万円利用で翌年以降永年無料",
        why: "一度100万円を達成すれば年会費が永久に無料。達成年は実質1.5%相当まで上がる。",
        cons: "年100万円の達成が前提で、届かなければ年会費5,500円がかかる。クレカ積立や一部チャージは100万円集計の対象外。対象店以外の基本還元率は0.5%と低い。100万円を無理に使おうとすると逆に損をするケースもある。",
        detail: "いわゆる「100万円修行」。達成すると①翌年以降の年会費永年無料 ②毎年10,000ポイント還元 ③SBI証券のクレカ積立が最大1.0%、の3つが得られる。10,000ポイント分を含めると100万円利用時の実質還元率は1.5%相当。集計は税込・家族カード合算可。【注意】クレカ積立の利用額は100万円の集計対象外。またJAL Pay・au PAY・Kyash・バンドルカードへのチャージも2026年3月から対象外になったため、以前の「修行の近道」は使えない。年100万円を使う見込みがないなら、無理に狙う必要はない。［確認日: 2026-08-09］",
        good: "年間100万円以上カードを使う人／SBI証券で積立する人",
        url: "https://www.smbc-card.com/camp/gold-numberless/index.jsp"
      },
      {
        name: "JCBゴールド",
        rate: "0.5%（優待店で最大10%）",
        fee: "11,000円",
        why: "還元率は通常のJCBと同じ。差が出るのはラウンジ・保険・優待の部分。",
        cons: "還元率目的なら年会費無料のJCB CARD Wの方が高くなる場合がある（Wは常時+1倍）。年会費11,000円の元を取るには付帯サービスを積極的に使う必要がある。40歳以上向けの主な選択肢ではあるが、旅行をしない人には恩恵が少ない。",
        detail: "【還元率だけなら不要】J-POINTパートナーの倍率はJCBオリジナルシリーズ共通なので、還元率目的なら年会費無料のJCB CARD Wで足りる。むしろWは常時+1倍が付く分、同じ店ではゴールドより高くなる。■【ゴールドの価値】空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）といった付帯サービス。■【例外的にゴールドが有利な場面】USJ・U-NEXT・Huluなど一部の優待店は「プレミアムカード」区分が設定されており、ゴールド以上だと倍率が上がる。Google Playも時期によってゴールド以上が10倍になることがある。■年齢制限がないため、40歳以降にJCBを作るならこちらが選択肢になる。［確認日: 2026-08-09］",
        good: "旅行が多い人／付帯保険や優待を使う人",
        url: "https://j-pointpartner.jcb.co.jp/"
      },
      {
        name: "PayPayカード ゴールド",
        rate: "1.0%",
        fee: "11,000円",
        why: "2026年6月の改定で上乗せが廃止され、基本還元率は無料版と同じになった。",
        cons: "2026年6月に上乗せ還元が廃止され、年会費に見合う還元率上のメリットがほぼなくなった。ソフトバンク・ワイモバイル以外のユーザーにはメリットが薄い。ソフトバンクの新プランに変更すると通信料の付与率が大幅に下がる点も注意。",
        detail: "以前あった「+0.5%上乗せ」は2026年6月2日で廃止。代わりに年100万円以上の決済で11,000ポイント（年会費相当）が付与される特典が新設された。実質的な価値はソフトバンク・ワイモバイル契約者向けの割引に寄っているため、キャリアが違う人はメリットが薄い。ソフトバンクの新プラン（ペイトク2など）に変更すると通信料の付与率が10%→1%に下がる点にも注意。［確認日: 2026-08-09］",
        good: "ソフトバンク／ワイモバイル利用者で年100万円使う人",
        url: "https://paypay.ne.jp/card-gold/"
      }
    ]
  },
  {
    group: "デビットカード（使いすぎを防ぎたい／審査なしで作りたい）",
    items: [
      {
        name: "V NEOBANKデビット（住信SBI）",
        rate: "1.5%（2026/11から1.25%）",
        fee: "年会費無料",
        why: "対象外取引がなく、公共料金や税金を含む全ての支払いで還元される点が強い。",
        cons: "2026年11月1日から還元率が1.25%に下がり、他社決済サービスへのチャージがポイント対象外になる。リアルカード（デビット付きキャッシュカード）が発行できないため、スマホ決済非対応の店では使えない。",
        detail: "【2026年11月1日から改定】還元率1.25%へ引き下げ、さらに他社決済サービスへのチャージ（VポイントPay・ANA Pay・au PAYなど）が軒並みポイント対象外に。鉄道・公共料金・税金・病院なども対象外になる。チャージルートの起点として使っていた人は11月以降その用途では還元されない。またリアルカード（デビット付きキャッシュカード）が発行できないため、スマホ決済非対応の店では使えない。［確認日: 2026-08-09］",
        good: "固定費もまとめて還元を受けたい人（ただし11月まで）",
        url: "https://www.netbk.co.jp/contents/lp/vneobank/"
      },
      {
        name: "第一生命NEOBANKデビット Premium",
        rate: "1.5%",
        fee: "年会費無料",
        why: "年会費無料のデビットとしてトップクラス。ポイントを現金に交換できる。",
        cons: "鉄道・チャージ・公共料金・税金・病院などは対象外で0.3%に下がる。特にチャージが対象外なので、チャージルートの起点には向かない。月間1,000円未満の利用は還元対象外。",
        detail: "月間利用1,000円以上で1.5%が適用（1,000円ごとに15ポイント）。貯まったポイントは500ポイント以上から現金に交換でき、500ポイント未満でもデビットの支払いに1ポイント1円で充当できる。Mastercardブランド、リアルカードの発行も可能。【重要な弱点】鉄道・チャージ・公共料金・税金・病院などは対象外で0.3%に下がる。特にチャージが対象外なので、チャージルートの起点には向かない。［確認日: 2026-08-09］",
        good: "リアルカードが必要な人／ポイントを現金化したい人",
        url: "https://www.netbk.co.jp/"
      },
      {
        name: "カテエネBANKデビット",
        rate: "1.0〜2.0%（月末残高200万円以上で2.0%）",
        fee: "年会費無料・残高200万円の維持が実質条件",
        why: "2026年11月のV NEOBANK改悪後の最有力代替起点。月末200万円を維持できればV NEOBANKの1.5%を上回る2.0%になる。中部電力の契約は不要。カテエネポイントはVポイント・楽天・dポイント・Pontaへ等価交換可能。",
        cons: "月末残高200万円の維持が条件で、資金を常に拘束する必要がある。200万円を下回った月は1.0%に下がる。知名度が低く情報が少ないため、今後の改定情報は公式サイトでの確認が必要。",
        good: "200万円の手元資金がある方、V NEOBANKからの移行先を探している方",
        detail: "住信SBIネット銀行の「カテエネBANK支店」のデビットカード。月末（末日）の円普通預金＋SBIハイブリッド預金の合計残高が200万円以上なら翌月は2.0%、200万円未満なら1.0%になる。中部電力ミライズとの電気・ガス契約は不要で誰でも口座開設可能。年会費無料・審査なし（デビットカード）。チャージルートの起点として：カテエネBANKデビット→au PAY→VポイントPayで合計3.0%（月5万円まで）になり、V NEOBANKルートの後継として最有力。なお、ルートとしてはV NEOBANKと完全に入れ替え可能なため、au PAYを普段使いしている方はそのままルートを引き継げる。200万円の維持が難しい場合は第一生命NEOBANKデビット Premium（条件なし1.5%）が代替になる。チャージ対象外取引については2026年8月時点では設定されていない（V NEOBANKのような改悪がないことを確認済み）。今後の改定情報はカテエネBANK公式で確認すること。［確認日: 2026-08-12／出典: カテエネBANK公式・各種情報サイト複数］",
        url: "https://katene.chuden.jp/clubkatene/p/lp/katenebank/"
      },
      {
        name: "デビットカード Point＋（住信SBIネット銀行）",
        rate: "1.25〜2.0%",
        fee: "年会費無料",
        why: "住信SBIネット銀行が2025年に始めた新しいデビットカード。残高や取引状況に応じて還元率が上がります。",
        cons: "最大2.0%にはスマプロランク4が必要で、残高や取引条件を満たす必要がある。ランク変動は翌々月に反映されるため即効性がない。住信SBIをメインバンクにしていない人には条件達成が難しい。",
        detail: "【どんなカードか】住信SBIネット銀行の口座から即時引き落としで支払うMastercardのデビットカード。年会費無料・審査なしで、15歳以上なら口座があれば作れます。■【還元率】基本1.25%。銀行の「スマプロランク」（円普通預金＋SBIハイブリッド預金の残高、または給与受取などの取引条件で決まる4段階）に応じて最大+0.75%が上乗せされ、最大2.0%になります。給与・年金の受け取り設定だけでも1.5%に届きます。■【V NEOBANKとの違い】同じ住信SBIですが別のカードです。V NEOBANKデビットは2026年11月に還元率1.25%へ引き下げ＋他社チャージが対象外になるため、その移行先として検討する価値があります。■ランクは判定月末の状態が翌々月から適用されるため、上げてもすぐには反映されません。［確認日: 2026-08-09］",
        good: "住信SBIをメインバンクにしている人",
        url: "https://www.netbk.co.jp/contents/lp/debit/pointplus/"
      }
    ]
  }
];

// ========== クレカ積立 ==========
// 証券口座の投信積立をクレカ払いにしたときの還元率。店舗決済とは仕組みが違い、
// 「毎月自動で」貯まるのが特徴。rate は月5万円積立時の実効還元率で並べ替える。
const INVEST_PLANS = [
  {
    broker: "DMM 株", card: "取引手数料に対して",
    rate: 0, rateLabel: "取引手数料の1%（DMM 株ポイント）",
    fee: "口座開設・維持費0円",
    note: "【他社のクレカ積立とは仕組みが違います】DMM 株は「クレカで積立」ではなく、「取引手数料の1%がポイント還元」される仕組み。例えば1日の国内株取引手数料が660円なら66ポイント（1pt=1円で現金化可能）。米国株は取引手数料が0円のためポイント対象外。現物取引の手数料は5万円以下55円・10万円以下88円・最大でも300万円超で880円と業界最安水準。単元未満株（S株）の取扱いはなし。新規口座開設で1ヶ月間の手数料無料キャンペーンも実施中。積立投信でクレカ積立をしたい場合はSBI証券や楽天証券が向く（DMM 株は個別株取引向け）。ペイ択では「クレカ積立とは別に、個別株取引の口座を持ちたい人」への選択肢として掲載。［確認日: 2026-08-13／出典: DMM.com証券公式］",
    directUrlFallback: "https://px.a8.net/svt/ejp?a8mat=4BA41D+C7ZCTU+1WP2+15QHIA", // 管理画面（admin/affiliates.html）が未設定のときのフォールバック
    isAffiliate: true,
    lpHash: "#/kabu-koza",
    trackingPixel: "https://www11.a8.net/0.gif?a8mat=4BA41D+C7ZCTU+1WP2+15QHIA"
  },
  {
    broker: "マネックス証券", card: "dカード",
    rate: 1.1, rateLabel: "1.1%（月5万円まで）",
    tiers: [[50000, 1.1], [70000, 0.6], [100000, 0.2]],
    fee: "年会費無料",
    note: "条件なし・年会費無料で1.1%は最高水準。月5万円を超えた分は段階的に下がり、5〜7万円部分は0.6%、7〜10万円部分は0.2%。月10万円を満額積み立てた場合の合計は730ポイントで、それでも他社を上回る。なお、マネックスカードは2026年10月にショッピング月間利用額が1万円未満だと還元率0%になる改定が予定されているが、dカードは現時点で変更予定なしと案内されている。［確認日: 2026-08-09］",
    url: "https://www.monex.co.jp/"
  },
  {
    broker: "三菱UFJ eスマート証券", card: "au PAY ゴールドカード",
    rate: 1.0, rateLabel: "1.0%（条件達成で最大2.0%）",
    fee: "年会費11,000円",
    note: "年間利用額の条件がなく、安定して1.0%を得られるのが強み。auの通信サービスとの連携条件を満たすと最大2.0%まで上がる。［確認日: 2026-08-09］",
    url: "https://kabu.com/"
  },
  {
    broker: "楽天証券", card: "楽天プレミアムカード",
    rate: 1.0, rateLabel: "1.0%",
    fee: "年会費11,000円",
    note: "【銘柄を問わず一律1.0%】楽天カード（一般）やゴールドでは銘柄の「代行手数料」で還元率が変わるが、プレミアムカードは代行手数料に関係なく一律1.0%。eMAXIS Slimシリーズなど低コストのインデックスファンドでも1.0%が適用される。楽天キャッシュ経由の積立（月5万円まで0.5%）と併用すれば、月15万円まで還元を受けられる。［確認日: 2026-08-12／出典: 楽天証券公式］",
    url: "https://www.rakuten-sec.co.jp/"
  },
  {
    broker: "SBI証券", card: "三井住友カード ゴールド（NL）",
    rate: 0, rateLabel: "最大1.0%（前年の利用額しだい）",
    fee: "年会費5,500円（年100万円利用で翌年以降無料）",
    conds: [
      { label: "前年の年間利用額が10万円以上", v: 0.25 },
      { label: "前年の年間利用額が100万円以上", v: 0.75, hint: "10万円以上の条件と合算で1.0%になります" }
    ],
    note: "【注意】前年のカード利用額で還元率が決まる方式。年100万円以上で1.0%だが、10万円未満だと還元率0%になる。メインカードとして日常的に使う前提の設計。100万円修行を達成すれば年会費も永年無料になるため、条件を満たせる人には強い。［確認日: 2026-08-09］",
    url: "https://www.sbisec.co.jp/"
  },
  {
    broker: "SBI証券", card: "三井住友カード（NL）",
    rate: 0, rateLabel: "最大0.5%（前年10万円以上の利用が条件）",
    fee: "年会費無料",
    conds: [
      { label: "前年の年間利用額が10万円以上", v: 0.5, hint: "未達成だと還元率0%になります" }
    ],
    note: "【注意】前年のカード年間利用額が10万円未満だとポイント付与が停止される。クレカ積立のためだけに作って普段使わない、という使い方だと還元を受けられない点に注意。［確認日: 2026-08-09］",
    url: "https://www.sbisec.co.jp/"
  },
  {
    broker: "楽天証券", card: "楽天カード",
    rate: 0.5, rateLabel: "0.5〜1.0%（銘柄の代行手数料による）",
    fee: "年会費無料",
    note: "【代行手数料0.4%以上の銘柄なら1.0%、0.4%未満なら0.5%】楽天証券の積立還元率は、投資信託の「代行手数料（信託報酬のうち楽天証券が受け取る部分）」が年率0.4%（税込）以上か未満かで分かれる。eMAXIS Slim全世界株式（オルカン）やeMAXIS Slim米国株式（S&P500）などの人気インデックスファンドは代行手数料が0.02%前後のため0.5%還元になる。アクティブファンドやバランスファンドなど代行手数料0.4%以上の銘柄なら1.0%還元。月10万円の積立で年間6,000〜12,000ポイント。楽天キャッシュ経由（月5万円まで0.5%）を併用すれば月15万円まで積立可能。［確認日: 2026-08-12／出典: 楽天証券公式］",
    url: "https://www.rakuten-sec.co.jp/"
  },
  {
    broker: "三菱UFJ eスマート証券", card: "au PAY カード",
    rate: 0.5, rateLabel: "0.5%",
    fee: "年会費無料",
    note: "年会費無料なので、クレカ積立のためだけに入会しても維持費がかからない。旧auカブコム証券。［確認日: 2026-08-09］",
    url: "https://kabu.com/"
  },
  {
    broker: "SBI証券", card: "三井住友カード プラチナプリファード",
    rate: 0.5, rateLabel: "1.0〜3.0%（年間利用額しだい）",
    fee: "年会費33,000円",
    conds: [
      { label: "前年の年間利用額が300万円以上", v: 1.0, hint: "合算で1.5%（300万円以上のティア）" },
      { label: "前年の年間利用額が500万円以上", v: 1.5, hint: "合算で3.0%（最大ティア）" }
    ],
    note: "【年会費は高いが積立額と別枠で回収しやすい】年間カード利用額に応じてクレカ積立の還元率が上がる仕組みで、年500万円以上の利用で3.0%に到達する。年会費33,000円でも、月10万円の積立を続ければ積立分だけで年3.6万ポイント（3.0%到達時）になり、年会費以上を積立ポイントだけで回収できる可能性がある。日常の買い物でも「リワードアップ」対象店で還元が上乗せされるため、メインカードとして使う前提なら有力な選択肢。年間利用額が500万円に届かない場合の還元率は三井住友カードの通常のティア（0.5〜1.0%）に準じる。［確認日: 2026-08-11／出典: 三井住友カード公式・比較メディア複数］",
    url: "https://www.smbc-card.com/nyukai/pt/index.jsp"
  },
  {
    broker: "マネックス証券", card: "マネックスカード",
    rate: 0, rateLabel: "0〜1.1%（2026年10月〜改定）",
    fee: "年会費無料",
    conds: [
      { label: "月5万円以上のショッピング利用（2026/10〜の新条件）", v: 0.6, hint: "さらに月7万円以上で0.8%、月10万円以上で1.1%に" }
    ],
    note: "【2026年10月から改定】これまでは条件なしで一律の還元率だったが、2026年10月分の積立から、ショッピング利用額に応じた変動制（0〜1.1%）に変わる予定。同じマネックス証券でもdカードなら引き続き条件なしで1.1%（月5万円まで）が続く見込みのため、10月以降はdカードとの差が開く可能性がある。改定の詳細はマネックス証券の告知で必ず確認すること。［確認日: 2026-08-11／出典: マネックス証券公式］",
    url: "https://www.monex.co.jp/"
  },
  {
    broker: "三菱UFJ eスマート証券", card: "JCBカード",
    rate: 0, rateLabel: "0〜1.0%",
    fee: "カードにより異なる",
    conds: [
      { label: "JCBゴールド以上のランク", v: 0.5 },
      { label: "JCB GOLD PREMIUM / JCB ザ・クラス", v: 0.5, hint: "ゴールド以上と合算で1.0%" }
    ],
    note: "JCBカードでの積立に対応。還元率はJCBのカードランク・条件によって0〜1.0%の幅がある。年会費無料のJCBオリジナルシリーズ一般カードだと下限に近く、上位カードほど上振れしやすい。正確な還元率は保有カードのランクごとにJCB・三菱UFJ eスマート証券の公式ページで確認すること。［確認日: 2026-08-11］",
    url: "https://kabu.com/"
  },
  {
    broker: "SBI証券", card: "TOKYUカード",
    rate: 0.25, rateLabel: "0.25〜3.0%",
    fee: "カードにより異なる",
    conds: [
      { label: "TOKYU CARD ClubQ JMBゴールド以上", v: 0.75, hint: "合算で1.0%" },
      { label: "TOKYU CARD GOLD Premium", v: 2.75, hint: "年会費22,000円のプレミアム限定で3.0%" }
    ],
    note: "【一般カードは0.25%、ゴールドで1.0%、プレミアムで3.0%】東急グループのTOKYUカードでSBI証券のクレカ積立が可能。一般のTOKYU CARD ClubQ JMBでは0.25%にとどまるが、ゴールドで1.0%、GOLD Premiumなら最大3.0%まで上がる。貯まるTOKYU POINTは東急ストア・東急ハンズ・東急線定期券で使いやすい。［確認日: 2026-08-12／出典: TOKYUカード公式・SBI証券公式］",
    url: "https://www.tokyu-card.co.jp/"
  },
  {
    broker: "SBI証券", card: "JCBカード",
    rate: 0, rateLabel: "0〜1.0%",
    fee: "カードにより異なる",
    conds: [
      { label: "JCBゴールド以上のランク", v: 0.5 },
      { label: "JCB GOLD PREMIUM / JCB ザ・クラス", v: 0.5, hint: "ゴールド以上と合算で1.0%" }
    ],
    note: "SBI証券でもJCBカードでの積立に対応。還元率はカードランクにより0〜1.0%。JCBカードは複数の証券会社（SBI証券・松井証券・三菱UFJ eスマート証券）で積立に使えるが、対応するカードの種類や還元率は証券会社ごとに異なるため、自分が使っている証券口座での対応状況を確認すること。［確認日: 2026-08-11］",
    url: "https://www.sbisec.co.jp/"
  },
  {
    broker: "SBI証券", card: "UCSカード",
    rate: 0.5, rateLabel: "0.5%",
    fee: "年会費無料（一般）",
    note: "UCSカードでの積立で、貯まるポイントはUポイントとmajica（イオン系）に交換可能。年会費無料で条件もシンプルなので、Uポイント・majicaを普段から使っている人には使いやすい選択肢。［確認日: 2026-08-11］",
    url: "https://www.ucs-net.co.jp/"
  },
  {
    broker: "SBI証券", card: "タカシマヤカード",
    rate: 0.1, rateLabel: "0.1〜0.5%",
    fee: "カードにより異なる",
    conds: [
      { label: "タカシマヤカードゴールド以上", v: 0.4, hint: "年会費11,000円のゴールドで0.5%に" }
    ],
    note: "【一般カードは0.1%、ゴールドで0.3%、プレミアムで0.5%】還元率は低めだが、貯まるタカシマヤポイントは髙島屋での買い物で1ポイント＝1円として使える。髙島屋を日常的に使う人でなければ、積立の還元率だけで選ぶメリットは薄い。［確認日: 2026-08-12／出典: SBI証券・タカシマヤ公式］",
    url: "https://www.takashimaya.co.jp/takashimayacard/"
  },
  {
    broker: "SBI証券", card: "アプラスカード",
    rate: 0.5, rateLabel: "0.5〜1.0%",
    fee: "カードにより異なる",
    conds: [
      { label: "APLUS CARD with ゴールド以上", v: 0.5, hint: "ゴールドで1.0%に" }
    ],
    note: "【一般カード0.5%、ゴールド以上で1.0%】貯まるポイントはAPLUS POINT。一般カードは年会費無料で0.5%、ゴールド以上は1.0%。ゴールドの年会費は5,500円（条件付きで無料になる場合あり）。正確な条件はアプラス公式サイトで確認すること。［確認日: 2026-08-12／出典: SBI証券・アプラス公式］",
    url: "https://www.aplus.co.jp/"
  },
  {
    broker: "SBI証券", card: "オリコカード",
    rate: 0.5, rateLabel: "0.5%",
    fee: "カードにより異なる",
    note: "貯まるのはOricoPoint。還元率は0.5%で条件による変動は小さく、シンプルに使いたい人向け。［確認日: 2026-08-11］",
    url: "https://www.orico.co.jp/"
  },
  {
    broker: "楽天証券", card: "みずほ楽天カード",
    rate: 0.5, rateLabel: "0.5〜1.0%（銘柄の代行手数料による）",
    fee: "年会費無料",
    note: "【楽天カードと同じ条件で決まる】代行手数料0.4%以上の銘柄なら1.0%、0.4%未満なら0.5%。eMAXIS Slim全世界株式などの人気低コストファンドは0.5%になる。楽天カード（一般）と還元率は同じで、みずほ銀行をメインバンクにしている人向けの選択肢。［確認日: 2026-08-12／出典: 楽天証券公式］",
    url: "https://www.rakuten-sec.co.jp/"
  },
  {
    broker: "松井証券", card: "JCBカード",
    rate: 0, rateLabel: "0〜1.0%",
    fee: "カードにより異なる",
    conds: [
      { label: "JCBゴールド以上のランク", v: 0.5 },
      { label: "JCB GOLD PREMIUM / JCB ザ・クラス", v: 0.5, hint: "ゴールド以上と合算で1.0%" }
    ],
    note: "松井証券でもJCBカードでの積立に対応。還元率はカードランクにより0〜1.0%。松井証券は投資信託の保有ポイントなど独自の還元制度もあるため、クレカ積立分だけでなく合わせて比較するとよい。［確認日: 2026-08-11］",
    url: "https://www.matsui.co.jp/"
  },
  {
    broker: "tsumiki証券", card: "エポスカード",
    rate: 0.1, rateLabel: "0.1〜0.5%",
    fee: "年会費無料",
    note: "丸井グループのtsumiki証券でエポスカード積立が可能。還元率は0.1〜0.5%とやや低めだが、貯まったポイントをそのままtsumiki証券での投資に回せる設計になっている。エポスカードを普段使いしていて、丸井・マルイでの買い物もある人には相性がよい。［確認日: 2026-08-11］",
    url: "https://www.tsumiki-sec.com/"
  },
  {
    broker: "大和コネクト証券", card: "セゾンカード",
    rate: 0.1, rateLabel: "0.1〜0.5%",
    fee: "年会費無料（一般）",
    note: "貯まるのは永久不滅ポイント。還元率は0.1〜0.5%で、カードの種類や条件によって変わる。永久不滅ポイントは有効期限がないのが特徴。［確認日: 2026-08-11］",
    url: "https://www.daiwa-connect.jp/"
  },
  {
    broker: "PayPay証券", card: "PayPayカード",
    rate: 0.7, rateLabel: "0.7%",
    fee: "年会費無料",
    note: "PayPayポイントが貯まり、そのままPayPay残高としても使える。還元率0.7%は条件による変動が少なく、シンプルで分かりやすい。普段からPayPayを使っている人には設定の手間も少ない。［確認日: 2026-08-11］",
    url: "https://www.paypay-sec.co.jp/"
  },
  {
    broker: "三菱UFJ eスマート証券", card: "au PAY ゴールドカード（クレジット）",
    rate: 0.5, rateLabel: "0.5〜1.0%",
    fee: "年会費11,000円",
    conds: [
      { label: "au/UQ mobileの対象プランに加入", v: 0.5, hint: "auマネ活プランなどの加入者限定で1.0%に" }
    ],
    note: "【au回線なしなら0.5%、auマネ活プラン加入で1.0%】年会費11,000円だが、au通信サービスとのセット割引を活かしている人向け。通信プランに入っていない場合は年会費無料のau PAYカード（0.5%）と同じ還元率になるため、通信プランを軸にした判断になる。［確認日: 2026-08-12／出典: 三菱UFJ eスマート証券公式］",
    url: "https://kabu.com/"
  },
  {
    broker: "三菱UFJ eスマート証券", card: "三菱UFJカード",
    rate: 0.5, rateLabel: "0.5〜1.0%",
    fee: "カードにより異なる",
    conds: [
      { label: "三菱UFJカード ゴールドプレステージ以上", v: 0.5, hint: "年会費11,000円のゴールドプレステージで1.0%に" }
    ],
    note: "【一般カード0.5%、ゴールドプレステージ以上で1.0%】貯まるのはMUFG CARD GLOBAL POINT＋。一般カードは年会費無料（初年度。年1回以上の利用で翌年も無料）で0.5%、ゴールドプレステージは年会費11,000円で1.0%。「カード選び」タブの三菱UFJ還元率シミュレーターで、普段の買い物の還元率も計算できる。［確認日: 2026-08-12／出典: 三菱UFJ eスマート証券公式］",
    url: "https://kabu.com/"
  },
  {
    broker: "セゾン投信（セゾンとつづく）", card: "セゾンカード",
    rate: 0.1, rateLabel: "0.1〜0.5%",
    fee: "年会費無料（一般）",
    note: "【サービス移管に注意】2026年5月に「セゾンポケット」から「セゾン投信（セゾンとつづく）」へサービスが移管された。移管前に積立設定していた人は、設定が引き継がれているか公式サイトで確認すること。貯まるのは永久不滅ポイントで、還元率は0.1〜0.5%。［確認日: 2026-08-11／出典: クレディセゾン公式］",
    url: "https://www.saison-toushin.co.jp/"
  },
  {
    broker: "セゾン投信（セゾンとつづく）", card: "UCカード",
    rate: 0.1, rateLabel: "0.1〜0.5%",
    fee: "カードにより異なる",
    note: "セゾンカードと同じくクレディセゾングループのUCカードでも積立に対応。貯まるのは永久不滅ポイントで還元率は0.1〜0.5%。こちらも2026年5月のサービス移管（セゾンポケット→セゾンとつづく）の対象。［確認日: 2026-08-11］",
    url: "https://www.saison-toushin.co.jp/"
  },
  {
    broker: "WealthNavi for AEON CARD", card: "イオンカード",
    rate: 0.5, rateLabel: "0.5%",
    fee: "年会費無料",
    note: "イオンカードとWealthNaviが提携するロボアドバイザー型の積立サービス。貯まるのはWAON POINTで、還元率は0.5%固定でシンプル。イオン系列でよく買い物をする人には貯めたポイントの使い道に困らない。他社のクレカ積立（投資信託を自分で選ぶ方式）とは仕組みが異なり、こちらはWealthNaviが自動で運用するロボアド型である点に注意。［確認日: 2026-08-11／出典: WealthNavi公式］",
    url: "https://www.wealthnavi.com/"
  },
];

const DEFAULT_ROUTES_MANUAL = [
{
    name: "V NEOBANKデビット → au PAY → VポイントPay",
    pays: [
      "VポイントPay",
      "au PAY"
    ],
    total: "合計 2.5%（月5万円まで）",
    steps: [
      "V NEOBANKデビット",
      "au PAY",
      "VポイントPay",
      "Visaタッチで支払い"
    ],
    gains: [
      "V NEOBANK→au PAYチャージ：Vポイント1.5%",
      "au PAY→VポイントPayチャージ：Pontaポイント0.5%",
      "VポイントPay決済：Vポイント0.5%"
    ],
    split: [
      {
        pt: "Vポイント",
        rate: 1.5,
        note: "V NEOBANK→au PAYチャージ分"
      },
      {
        pt: "Pontaポイント",
        rate: 0.5,
        note: "au PAY→VポイントPayチャージ分"
      },
      {
        pt: "Vポイント",
        rate: 0.5,
        note: "VポイントPayでの決済分"
      }
    ],
    atStore: {
      rate: "2.5%",
      method: "VポイントPayをVisaタッチ決済で支払い（事前にau PAY経由でチャージ）"
    },
    starter: "V NEOBANKデビット（住信SBI・年会費無料・審査なし）。⚠️ 2026年11月1日からチャージポイント0%になるため、11月以降はカテエネBANKデビットまたは第一生命NEOBANKデビット Premiumに切り替えてください。",
    howto: {
      prep: [
        "住信SBIネット銀行でV NEOBANK口座を開設し、デビットを発行する（⚠️ 11月以降はカテエネBANKデビットに切り替え）",
        "au PAYアプリをインストールする",
        "VポイントPayアプリをインストールしてVポイントIDでログインする"
      ],
      flow: [
        "au PAYにV NEOBANKデビット（11月以降は代替カード）からチャージする（月5万円まで）",
        "au PAY残高（Apple Pay経由）でVポイントPayにチャージする",
        "お店でVisaのタッチ決済として支払う"
      ],
      time: "口座開設に数日。以降の作業は月10分ほど"
    },
    note: "年会費も審査もなしで2.5%に届き、しかも月5万円まで回せるのが強み。楽天ペイルート（月1万円）より実際に得られる額が大きいため、まずはこちらを検討する価値があります。VポイントPayはVisaタッチとして全国で使えるので汎用性も高い。【重要】V NEOBANKデビットは2026年11月1日から他社決済サービスへのチャージがポイント対象外になります。11月以降の代替起点としてはカテエネBANKデビット（月末残高200万円で2.0%）や第一生命NEOBANKデビット Premium（条件なし1.5%）が候補です。［確認日: 2026-08-12／出典: 住信SBIネット銀行公式発表］",
    url: "https://www.netbk.co.jp/contents/lp/vneobank/",
    shutdownWarn: "⚠️ 2026年10月31日で終了予定。2026年11月1日からV NEOBANKのチャージポイントが0%になります。",
    caution: "2026年11月1日からV NEOBANKからのチャージが還元対象外。代替はカテエネBANKデビット（月末残高200万円条件）または第一生命NEOBANKデビット Premium。",
    starters: {
      "V NEOBANKデビット（住信SBI）": 1.5,
      "カテエネBANKデビット": 2.0
    }
  },
{
    name: "V NEOBANKデビット → モバイルWAON（イオンでの買い物）",
    pays: [
      "WAON",
      "イオン"
    ],
    total: "合計 2.5%",
    onlyAt: [
      "イオン",
      "マックスバリュ",
      "ミニストップ",
      "ザ・ビッグ"
    ],
    steps: [
      "V NEOBANKデビット",
      "モバイルWAON（Apple Pay）",
      "イオン・ミニストップで支払い"
    ],
    gains: [
      "V NEOBANK→WAONチャージ：Vポイント1.5%",
      "イオングループ・ミニストップでのWAON決済：1.0%（要WAON会員登録）"
    ],
    split: [
      {
        pt: "Vポイント",
        rate: 1.5,
        note: "チャージ分"
      },
      {
        pt: "WAON POINT",
        rate: 1,
        note: "イオン・ミニストップは2倍"
      }
    ],
    starter: "V NEOBANKデビット（年会費無料・審査なし）。",
    howto: {
      prep: [
        "V NEOBANKデビットを発行する（⚠️ 2026年11月1日からチャージポイント0%になるため、11月以降はカテエネBANKデビットまたは第一生命NEOBANKデビット Premiumに切り替え）",
        "Apple PayにモバイルWAONを追加する",
        "【必須】WAONの会員登録を済ませる ※未登録だと0.5%に半減します"
      ],
      flow: [
        "モバイルWAONにV NEOBANKデビット（11月以降は代替カード）からチャージする",
        "イオン・マックスバリュ・ミニストップで支払う"
      ],
      time: "設定20分ほど。イオンをよく使うなら効果が大きい"
    },
    note: "【イオングループ限定のルートです】イオン・マックスバリュ・ミニストップではWAONがいつでもポイント2倍のため、通常0.5%が1.0%になります。他の店では2倍にならないので、このルートの旨みはイオン系だけ。【必ず会員登録を】WAON会員登録をしていないと0.5%のままで合計2.0%に下がります。毎月20日・30日の5%OFFとは別枠なので、感謝デーに使えばさらに有利。【重要】2026年11月1日からV NEOBANKのチャージポイントが0%になります。代替起点はカテエネBANKデビット（月末残高200万円で2.0%・WAONチャージも対象）が候補です。［確認日: 2026-08-12／出典: 住信SBIネット銀行公式発表］",
    url: "https://www.waon.net/",
    shutdownWarn: "⚠️ 2026年10月31日で終了予定。2026年11月1日からV NEOBANKのチャージポイントが0%になります。",
    caution: "WAON会員登録を忘れると還元率が半減する。2026年11月1日からV NEOBANKのチャージが還元対象外になる予定。",
    atStore: {
      rate: "2.5%",
      method: "モバイルWAONで支払い（事前にV NEOBANKデビットからチャージ・要WAON会員登録）"
    },
    starters: {
      "V NEOBANKデビット（住信SBI）": 1.5,
      "カテエネBANKデビット": 2.0
    }
  },
{
    name: "クレカ → ANA Pay → モバイルSuica",
    howto: {
      prep: [
        "リクルートカードを発行する（年会費永年無料）",
        "ANA Payアプリをインストールし、ANAマイレージクラブ会員番号で登録する",
        "モバイルSuicaをインストール（またはiPhoneのウォレットに追加）"
      ],
      flow: [
        "ANA Payアプリでリクルートカードからチャージする",
        "ANA Pay（Apple Pay / Google Pay経由）でモバイルSuicaにチャージする",
        "改札やお店でSuicaとして使う（全国の交通系ICエリア・132万店舗以上で利用可）"
      ],
      time: "初回の準備に1週間ほど（カード発行を含む）。以降は月5分程度"
    },
    split: [
      {
        pt: "クレカのポイント",
        rate: 1.2,
        note: "クレカ→ANA Payチャージ分（起点カードによる）"
      },
      {
        pt: "ANAマイル",
        rate: 0.5,
        note: "ANA Pay→Suicaチャージ分"
      }
    ],
    starter: "リクルートカード（年会費永年無料・1.2%）。電子マネーチャージでもポイントが付く数少ないカードで、この用途の定番。ただし月間の付与上限あり。",
    pays: [
      "Suica",
      "ANA Pay",
      "交通系"
    ],
    total: "合計 1.7%（起点カードによる）",
    steps: [
      "高還元クレカ",
      "ANA Pay",
      "モバイルSuica",
      "改札・買い物で利用"
    ],
    gains: [
      "クレカ→ANA Payチャージ：カードの還元率（1.0〜1.5%）",
      "ANA Pay→Suicaチャージ：ANAマイル0.5%",
      "Suicaは全国の交通系ICエリアと132万店舗以上で使える"
    ],
    atStore: {
      rate: "2.0%",
      method: "ANA Pay経由でチャージしたモバイルSuicaで支払い"
    },
    note: "SuicaはICOCA・SUGOCA・TOICAなど全国の交通系ICと相互利用でき、関西でもそのまま使える。貯まるのがANAマイルなので、マイルの使い道がある人ほど価値が上がる（1マイル2円以上で使えることも）。ANAダイナース（年会費33,000円）なら直接チャージで1.6%相当のANAマイル。［確認日: 2026-08-09］",
    url: null,
    caution: "Suicaへのチャージは月5万円までの制限がある。また三井住友カードからJAL Pay・au PAYへのチャージは2026年3月以降ポイント対象外になっており、以前の定番ルートは使えない。",
    starters: {
      "リクルートカード": 1.2,
      "カテエネBANKデビット": 2.0,
      "エポスゴールド": 0,
      "V NEOBANKデビット（住信SBI）": 1.5,
      "楽天カード": 1,
      "三井住友カード（NL）": 0
    }
  },
{
    name: "J-WESTカード → モバイルICOCA",
    howto: {
      prep: [
        "J-WESTカードを発行する（一般 年1,100円／ゴールド 11,000円）",
        "モバイルICOCAをインストール（AndroidアプリまたはiPhoneのウォレットに追加）",
        "モバイルICOCAアプリで「WESTER ID連携」を必ず済ませる ※これを忘れるとポイントが付きません"
      ],
      flow: [
        "モバイルICOCAアプリでJ-WESTカードを登録する",
        "アプリからチャージする（1回2万円まで、深夜2〜4時は不可）",
        "改札やお店でICOCAとして使う"
      ],
      time: "カード発行後、設定は15分ほど。以降はチャージするだけ"
    },
    split: [
      {
        pt: "WESTERポイント",
        rate: 1.5,
        note: "モバイルICOCAへのチャージ分（ゴールドは3.0%）"
      }
    ],
    starter: "J-WESTカード（一般 年1,100円／ゴールド 11,000円）。ゴールドなら3.0%まで上がる。",
    pays: [
      "ICOCA",
      "交通系"
    ],
    total: "1.5%（ゴールドは3.0%）",
    steps: [
      "J-WESTカード",
      "モバイルICOCA",
      "改札・買い物で利用"
    ],
    gains: [
      "モバイルICOCAへのチャージ：WESTERポイントが3倍（基本ポイント含む）",
      "J-WESTゴールドならさらに上乗せで3.0%"
    ],
    atStore: {
      rate: "1.5%",
      method: "モバイルICOCAにJ-WESTカードからチャージして支払い"
    },
    note: "経由が1段だけで手間が少ないのが利点。WESTERポイントは全国のJR西日本系サービスやポイント交換で使えます。【重要】SMART ICOCAでのチャージは3倍の対象外で0.5%（ゴールドで1%）にとどまるため、必ずモバイル版（Android版またはApple PayのICOCA）を使うこと。モバイルICOCAアプリ内で「WESTER ID連携」を済ませていないとポイントが付かない点にも注意。なおSMART ICOCAのクイックチャージは2026年10月で終了予定のため、今のうちにモバイル版へ移行しておくのが安全。［確認日: 2026-08-09］",
    url: "https://wester.jr-odekake.net/j-west/point/",
    caution: "クレカチャージの上限額がネックになる場合がある。モバイルICOCAは1回2万円まで、深夜2〜4時はチャージ不可。",
    starters: {
      "J-WESTカード ゴールド": 3
    }
  },
{
    name: "クレカ → VポイントPay",
    howto: {
      prep: [
        "VポイントPayアプリをインストールし、Vポイント（旧Tポイント）IDでログインする",
        "本人確認またはOlive連携を済ませる（チャージ上限が月100万円に上がります）",
        "Visa/Mastercardブランドで3Dセキュア対応のクレカを用意する"
      ],
      flow: [
        "VポイントPayアプリでクレカからチャージする（手数料無料）",
        "お店でVisaのタッチ決済として支払う"
      ],
      time: "設定は10分ほど。経由が1段だけなので初心者向き"
    },
    split: [
      {
        pt: "クレカのポイント",
        rate: 1,
        note: "チャージ元カードによる（リクルートカードなら1.2%）"
      },
      {
        pt: "Vポイント",
        rate: 0.5,
        note: "VポイントPayのVisa利用特典"
      }
    ],
    starter: "Visa/Mastercardブランドかつ3Dセキュア対応なら種類を問わずチャージ可。基本還元率の高いカード（リクルートカード1.2%など）を使うと有利。",
    pays: [
      "VポイントPay"
    ],
    total: "合計 約1.5%",
    steps: [
      "Visa/Mastercardのクレカ",
      "VポイントPay",
      "Visaタッチで支払い"
    ],
    gains: [
      "クレカのチャージ還元：カードによる（1%前後）",
      "VポイントPayのVisa利用特典：0.5%"
    ],
    atStore: {
      rate: "1.5%",
      method: "VポイントPayをVisaタッチで支払い（事前にクレカからチャージ）"
    },
    note: "2025年11月のアップデートで、Visa/Mastercardブランドかつ3Dセキュア対応のカードなら種類を問わず手数料無料でチャージできるようになった。一方で、三井住友カード発行カードからのチャージ特典0.25%は同時に廃止されている。チャージ上限は本人確認またはOlive連携で月100万円。［確認日: 2026-08-09］",
    url: "https://www.smbc-card.com/nyukai/magazine/tips/Vpoint-method.jsp",
    caution: "三井住友カードからVポイントPayへのチャージ分は、100万円修行の集計対象外。エポスゴールドは2026年8月1日からVポイントPay等へのチャージがポイント対象外（0%）のため起点として使用不可。V NEOBANKデビットからのチャージは2026年11月1日からポイント対象外になる予定。",
    starters: {
      "リクルートカード": 1.2,
      "カテエネBANKデビット": 2.0,
      "V NEOBANKデビット（住信SBI）": 1.5,
      "エポスゴールド": 0,
      "楽天カード": 1,
      "三井住友カード（NL）": 0
    }
  },
{
    name: "ANA Pay → 楽天Edy → 楽天キャッシュ → 楽天ペイ",
    affKey: "daiichi-neobank-debit-premium",
    howto: {
      prep: [
        "ANA Payにチャージできるクレカ／デビットを用意する（リクルートカード1.2%、カテエネBANKデビット2.0%、第一生命NEOBANKデビット Premium 1.5%など。※エポスカードは2026年8月からANA Payチャージが対象外のため起点に使えません）",
        "ANA Payアプリをインストールし、ANAマイレージクラブ会員番号で登録する",
        "楽天Edy機能付きの楽天カード（プラスチックの現物）を用意する ※iPhoneの場合は必須",
        "楽天ペイアプリをインストールし、楽天IDでログインする"
      ],
      flow: [
        "ANA Payアプリで起点カードからチャージする（本人確認済みなら1日10万円・月30万円まで）",
        "ANA Payの残高を楽天Edyへ移す",
        "楽天ペイアプリで楽天Edy残高を楽天キャッシュに交換する（月1万円まで ※2026年8月から10万円→1万円に縮小）",
        "お店で楽天ペイの「楽天キャッシュ」を選んで支払う"
      ],
      time: "初回の準備に1〜2週間（カード発行を含む）。慣れれば毎月の作業は10分程度"
    },
    split: [
      {
        pt: "起点カードのポイント",
        rate: 1.5,
        note: "クレカ→ANA Payチャージ分（起点カードによる）"
      },
      {
        pt: "ANAマイル",
        rate: 0.5,
        note: "ANA Pay→楽天Edy移行分"
      },
      {
        pt: "楽天ポイント",
        rate: 1,
        note: "楽天ペイでの決済分"
      }
    ],
    starter: "リクルートカード（1.2%）。エポスゴールドは2026年8月1日からANA Payチャージがポイント対象外（0%）になったため、現在は起点として使えません。第一生命NEOBANKデビット Premium（1.5%）またはカテエネBANKデビット（月末残高200万円で2.0%）が最有力の起点です。",
    pays: [
      "楽天ペイ",
      "ANA Pay",
      "楽天Edy"
    ],
    total: "合計 3.0%（月1万円まで）",
    steps: [
      "対象クレカ/デビット",
      "ANA Pay",
      "楽天Edy",
      "楽天キャッシュ",
      "楽天ペイで支払い"
    ],
    gains: [
      "クレカ/デビット→ANA Pay チャージ：起点カードによる（最大2.0%）",
      "ANA Pay→楽天Edy：ANAマイル0.5%",
      "楽天ペイ支払い：楽天ポイント約1%"
    ],
    atStore: {
      rate: "2.5〜3.5%",
      method: "楽天ペイで支払い（事前にANA Pay→楽天Edy→楽天キャッシュへ移しておく）"
    },
    note: "【2026年8月から注意点が増えました】①月に動かせる金額が月1万円に制限（2026年8月1日から楽天Edy→楽天キャッシュの交換上限が月10万円→1万円に縮小）。②エポスゴールドは2026年8月1日からANA Payへのチャージがポイント対象外（0%）になったため、起点として使えなくなりました。現在の有力な起点は：リクルートカード（1.2%）、第一生命NEOBANKデビット Premium（1.5%）、カテエネBANKデビット（月末残高200万円で2.0%）。ANA Payのチャージ上限は本人確認済みで1日10万円・月30万円。iPhoneでは楽天Edyの物理カードが必要です。［確認日: 2026-08-12／出典: 楽天公式・各種情報サイト複数］",
    url: "https://cash.rakuten.co.jp/",
    articleUrl: "articles/ana-pay-rakuten-edy-cash-route.html",
    caution: "楽天Edy→楽天キャッシュの交換上限が月1万円（2026年8月改悪済み）。エポスゴールドは現在チャージ起点として使用不可。iPhoneは楽天Edyの物理カードが必要。",
    starters: {
      "エポスゴールド": 0,
      "V NEOBANKデビット（住信SBI）": 1.5,
      "カテエネBANKデビット": 2.0,
      "リクルートカード": 1.2,
      "楽天カード": 1,
      "三井住友カード（NL）": 0
    }
  },
{
    name: "V NEOBANKデビット → au PAY → 請求書払い（税金・公共料金）",
    pays: [
      "au PAY",
      "税金・公共料金"
    ],
    total: "1.5%",
    steps: [
      "V NEOBANKデビット",
      "au PAY",
      "au PAY請求書払い"
    ],
    gains: [
      "V NEOBANK→au PAYチャージ：Vポイント1.5%",
      "請求書払い自体には還元なし"
    ],
    split: [
      {
        pt: "Vポイント",
        rate: 1.5,
        note: "チャージ分のみ"
      }
    ],
    starter: "V NEOBANKデビット。",
    howto: {
      prep: [
        "V NEOBANKデビットを発行する（⚠️ 2026年11月1日からチャージポイント0%になるため、11月以降はカテエネBANKデビットに切り替え）",
        "au PAYアプリをインストールする",
        "支払う請求書（納付書）にバーコードがあるか確認する"
      ],
      flow: [
        "au PAYにV NEOBANKデビット（11月以降は代替カード）からチャージする（月5万円まで）",
        "au PAYアプリの「請求書支払い」でバーコードを読み取る",
        "支払いを確定する"
      ],
      time: "初回設定後は1件あたり1分ほど"
    },
    note: "通常はポイントがつかない税金・公共料金でも、チャージ段階の1.5%を確保できるのが要点。V NEOBANKデビットで直接払うと税金は対象外（0.3%）になるため、au PAYを挟む意味があります。【注意】請求書払い自体にはPontaポイントが付きません。バーコードのない納付書は対象外。【重要】2026年11月1日からV NEOBANKのチャージポイントが0%になります。代替はカテエネBANKデビット（月末残高200万円で2.0%）が有力です。［確認日: 2026-08-12／出典: 住信SBIネット銀行公式発表・au PAY公式］",
    url: "https://aupay.wallet.auone.jp/",
    articleUrl: "articles/aupay-seikyusho-charge-route.html",
    shutdownWarn: "⚠️ 2026年10月31日で終了予定。2026年11月1日からV NEOBANKのチャージポイントが0%になります。",
    caution: "au PAYへのチャージ上限は月5万円。2026年11月1日からV NEOBANKのチャージが対象外になります。バーコードのない納付書は対象外。",
    starters: {
      "V NEOBANKデビット（住信SBI）": 1.5,
      "カテエネBANKデビット": 2.0
    }
  },
{
    name: "三井住友カード → Revolut → ANA Pay / Suica",
    pays: [
      "Revolut",
      "ANA Pay",
      "Suica"
    ],
    total: "合計 0.5〜2.0%（起点カード次第）",
    steps: [
      "Mastercardの三井住友カード",
      "Revolut",
      "ANA Pay / Suica 等"
    ],
    gains: [
      "三井住友カード→Revolut：Vポイント0.5%（100万円修行のカウント対象）",
      "Revolut→ANA Pay：ANA Pay側の処理（マイル付与あり）"
    ],
    split: [
      {
        pt: "Vポイント",
        rate: 0.5,
        note: "三井住友カード→Revolutチャージ分（Mastercard版限定）"
      }
    ],
    starter: "三井住友カード ゴールド（NL）またはOlive（Mastercardブランド）。100万円修行中の人がRevolutを経由することで、ANA PayやSuica等に届かせながら修行カウントを積める。",
    howto: {
      prep: [
        "三井住友カード ゴールド（NL）またはOliveをMastercardブランドで発行する（Visaだと手数料1.7%が発生して損）",
        "Revolutアプリをインストールして本人確認を済ませる",
        "RevolutにMastercardの三井住友カードを登録する",
        "ANA Payアプリをインストールし、ANAマイレージクラブ会員番号で登録する"
      ],
      flow: [
        "三井住友カード（Mastercard）でRevolutにチャージする",
        "RevolutからANA Payへチャージする（またはSuicaなど対応先へ）",
        "ANA PayをSuicaや楽天Edy経由で使う、またはQRコード決済として使う"
      ],
      time: "初回設定に1〜2週間。以降は月次の管理作業が必要"
    },
    note: "【三井住友ゴールドNLの100万円修行を進めながらチャージする唯一の現実的なルート】2026年3月から三井住友カードはJAL Pay・au PAY・Kyash等への直接チャージが修行カウント対象外になりましたが、RevolutへのチャージはMastercard版であれば引き続き100万円修行のカウント対象（三井住友カード公式FAQで確認済み・2026年7月時点）。Revolut自体はポイントを付与しないため、還元はクレカ側の0.5%のみ。【手数料に注意】Mastercardのクレカ・Visaのデビットは手数料無料。Visaのクレジットカードは1.7%の手数料が発生するため三井住友カードのVisaは使ってはいけない。REvolutからANA Payへのチャージも可能で、ANA Payを通じてSuicaや楽天Edyへさらに繋ぐことができる（各サービスの対応状況による）。改定が多い領域なので実行前に公式を確認すること。［確認日: 2026-08-12／出典: 三井住友カード公式FAQ・各種情報サイト複数］",
    url: "https://www.revolut.com/ja-JP/",
    caution: "Mastercardブランドが必須。VisaクレカはRevolutへの手数料が1.7%かかり損になる。改定が多いため実行前に必ず最新情報を確認すること。",
    starters: {
      "三井住友カード（NL）": 0.5
    }
  },
{
    name: "JALカードSuica → ANA Pay（二刀流）",
    howto: {
      prep: [
        "JALカードSuicaを発行する",
        "ANA Payアプリ、楽天Edy（現物カード）、楽天ペイアプリを揃える"
      ],
      flow: [
        "JALカードSuicaからANA Payにチャージする",
        "ANA Pay → 楽天Edy → 楽天キャッシュ と移す（楽天Edyからの交換は月1万円まで）",
        "お店で楽天ペイの「楽天キャッシュ」で支払う"
      ],
      time: "経由が多く、月1万円しか回せないため、手間の割に効果は限定的"
    },
    split: [
      {
        pt: "JALマイル",
        rate: 1,
        note: "JALカードSuicaのチャージ分"
      },
      {
        pt: "ANAマイル",
        rate: 0.5,
        note: "ANA Pay経由分"
      },
      {
        pt: "楽天ポイント",
        rate: 1,
        note: "楽天ペイでの決済分"
      }
    ],
    pays: [
      "楽天ペイ",
      "ANA Pay",
      "Suica"
    ],
    total: "合計 2.5%（月1万円まで）",
    steps: [
      "JALカードSuica",
      "ANA Pay",
      "楽天Edy",
      "楽天キャッシュ",
      "楽天ペイ"
    ],
    gains: [
      "JALカードSuicaのチャージ：JALマイル1.0%",
      "ANA Pay経由：ANAマイル0.5%",
      "楽天ペイ支払い：楽天ポイント"
    ],
    atStore: {
      rate: "2.5%",
      method: "楽天ペイで支払い（JALカードSuica→ANA Pay→楽天Edy→楽天キャッシュ経由）"
    },
    note: "JALとANA両方のマイルを同時に貯めたい人向け。かつて主流だった「JAL Pay→ANA Pay」ルートは、JAL Pay側の制度改定で他社Payへのチャージ時のマイル還元率が大きく下がったため、その代替として使われている。［確認日: 2026-08-09］",
    url: null,
    caution: "マイル重視の構成。現金換算での効率は他ルートに劣る場合がある。また楽天Edy→楽天キャッシュの交換上限が月1万円のため、回せる金額は小さい。",
    starters: {}
  },
{
    name: "カテエネBANKデビット → au PAY → VポイントPay",
    pays: [
      "VポイントPay",
      "au PAY"
    ],
    total: "合計 3.0%（月末残高200万円条件・月5万円まで）",
    steps: [
      "カテエネBANKデビット",
      "au PAY",
      "VポイントPay（Visaタッチ）"
    ],
    gains: [
      "カテエネBANKデビット→au PAYチャージ：カテエネポイント2.0%",
      "au PAY→VポイントPayチャージ：Pontaポイント0.5%",
      "VポイントPay決済：Vポイント0.5%"
    ],
    split: [
      {
        pt: "カテエネポイント",
        rate: 2.0,
        note: "カテエネBANKデビット→au PAYチャージ分（月末残高200万円以上が条件）"
      },
      {
        pt: "Pontaポイント",
        rate: 0.5,
        note: "au PAY→VポイントPayチャージ分"
      },
      {
        pt: "Vポイント",
        rate: 0.5,
        note: "VポイントPayでの決済分"
      }
    ],
    starter: "カテエネBANKデビット（中部電力ミライズ × 住信SBIネット銀行。月末残高200万円以上で還元率2.0%）。カテエネポイントはVポイント・楽天ポイント・dポイント・Pontaへ等価交換可能。",
    howto: {
      prep: [
        "カテエネBANKの口座を開設する（中部電力契約不要・無料）",
        "月末に残高200万円以上を維持できる資金を用意する（定期預金・SBIハイブリッド預金も合算可）",
        "au PAYアプリをインストールする",
        "VポイントPayアプリをインストールしてVポイントIDでログインする"
      ],
      flow: [
        "au PAYにカテエネBANKデビットからチャージする（月5万円まで）",
        "au PAY残高（Apple Pay経由）でVポイントPayにチャージする",
        "お店でVisaのタッチ決済として支払う"
      ],
      time: "口座開設に数日。200万円の資金確保がハードルになる"
    },
    note: "【V NEOBANK廃止後の最有力代替ルート】2026年11月1日にV NEOBANKデビットのチャージポイントが0%になった後、同じ住信SBIネット銀行グループの「カテエネBANK支店」デビットカードが最も注目される代替です。月末の残高200万円以上という条件さえ満たせば、デビットカードの還元率が2.0%になり、V NEOBANKの1.5%を上回ります。カテエネポイントは主要ポイントへ等価交換できるため、使い勝手も良好。中部電力の契約は不要で誰でも口座開設できますが、200万円を常に維持できる方向けの選択肢です。【資金が用意できない場合】条件なしで1.5%の第一生命NEOBANKデビット Premiumが現実的な選択肢になります。同ルート、同構成、同条件で使えます。カテエネポイントは1ポイント＝1円相当でVポイント・楽天ポイント・dポイント・Ponta・nanaco・WAON等へ等価交換可能。JALマイルへの交換は50%レート（0.5マイル/1pt）。［確認日: 2026-08-12／出典: カテエネBANK公式・各種情報サイト複数］",
    url: "https://katene.chuden.jp/clubkatene/p/lp/katenebank/",
    articleUrl: "articles/kateene-bank-debit-shindan.html",
    caution: "月末（月末日）の残高が200万円未満だと翌月は1.0%に下がる。残高が一時的に下がるタイミングがないか注意。au PAYへのチャージ上限は月5万円。",
    atStore: {
      rate: "3.0%",
      method: "VポイントPayをVisaタッチ決済で支払い（事前にau PAY経由でチャージ）"
    },
    starters: {
      "カテエネBANKデビット": 2.0
    }
  }
];

const ROUTE_SEGMENTS = {
  edy_cash_pay: {
    id: "edy_cash_pay",
    entryNode: "ANA Pay",
    entryLabel: "ANA Pay",
    pays: ["楽天Pay", "楽天Edy", "楽天キャッシュ"],
    steps: [
      "楽天Edy",
      "楽天キャッシュ",
      "楽天Pay（チャージ払い）",
      "お店で楽天ポイントカードを提示のうえ楽天Payで支払い"
    ],
    gains: [
      "ANA Pay→楽天Edyチャージ：ANAマイル0.5%",
      "楽天Edy→楽天キャッシュチャージ：0%（2026/8/1〜月1万円まで の上限あり）",
      "楽天キャッシュ→楽天Pay（チャージ払い）：0%",
      "楽天Payでのお店決済：楽天ポイント1.0%＋楽天ポイントカード提示で楽天キャッシュ分0.5%＝1.5%（カウント期間＝前々月16日〜前月15日に2回以上提示が条件。2回未満だと1.0%止まり）"
    ],
    split: [
      { pt: "ANAマイル", rate: 0.5, note: "ANA Pay→楽天Edyチャージ分" },
      { pt: "楽天ポイント", rate: 1.5, note: "楽天Payでのお店決済分（カウント期間中に楽天ポイントカード等を2回以上提示した場合）" }
    ],
    rate: 2.0,
    howtoPrep: ["ANA Pay・楽天ペイ（楽天Edy／楽天キャッシュ含む）の各アプリをインストールする"],
    howtoFlow: [
      "ANA Payで楽天Edyにチャージする",
      "楽天Edyで楽天キャッシュにチャージする（2026/8/1〜月1万円まで）",
      "楽天キャッシュで楽天Pay（チャージ払い）にチャージする",
      "お店で楽天ポイントカードも提示しつつ楽天Payで支払う（カウント期間中に2回以上の提示が必要）"
    ],
    atStore: { rate: "2.0%（この区間のみ。2回未満提示だと1.5%が1.0%に下がる）", method: "楽天Payで支払い、楽天ポイントカードも合わせて提示" },
    caution: "楽天Edy→楽天キャッシュのチャージには2026年8月1日から月1万円の上限が新設されている。楽天Payでの1.5%還元は、カウント期間（前々月16日〜前月15日）中に楽天ポイントカード等を2回以上提示することが条件（2025年7月〜。2回未満だと1.0%止まり）。"
  },
  nanaco_smaho_prepaid: {
    id: "nanaco_smaho_prepaid",
    entryNode: "モバイルnanaco",
    entryLabel: "モバイルnanaco",
    pays: ["バニラVISA"],
    steps: [
      "スマホプリペイド",
      "バニラVISA（Visa eギフト）"
    ],
    gains: [
      "モバイルnanaco→スマホプリペイドチャージ：0.5%",
      "スマホプリペイド→バニラVISAチャージ：1.5%"
    ],
    split: [
      { pt: "ポイント", rate: 0.5, note: "モバイルnanaco→スマホプリペイドチャージ分" },
      { pt: "ポイント", rate: 1.5, note: "スマホプリペイド→バニラVISAチャージ分" }
    ],
    rate: 2.0,
    howtoPrep: [
      "nanacoアプリ（モバイルnanaco）をインストールする",
      "スマホプリペイドアプリをインストールする",
      "バニラVISA（Visa eギフト）はミニストップなど取扱店で購入、またはアプリ上でチャージする"
    ],
    howtoFlow: [
      "モバイルnanaco残高でスマホプリペイドにチャージする",
      "スマホプリペイド残高でバニラVISA（Visa eギフト）にチャージする"
    ],
    atStore: { rate: "2.0%（この区間のみ）", method: "バニラVISA（Visa eギフト）として使う" },
    caution: "モバイルnanaco・スマホプリペイド・バニラVISAそれぞれに月間チャージ上限がある場合がある。"
  },
  idare_exit_wanbank: {
    id: "idare_exit_wanbank",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["PayPay", "ワンバンク"],
    steps: [
      "ワンバンク（入会・コード入力で300円ボーナスあり）",
      "ソフトバンクカード（LINEMO以外は店頭申込のみ・新規不可）",
      "PayPay",
      "お店でPayPay決済（PayPay Step達成）"
    ],
    gains: [
      "IDARE→ワンバンクチャージ：0%（IDAREの価値はチャージ時の還元ではなく残高保有ボーナス。下記balanceBonus参照）",
      "ワンバンク→ソフトバンクカードチャージ：0%",
      "ソフトバンクカード→PayPayチャージ：0%",
      "PayPayでのお店決済：1.0%（PayPay Step達成時）"
    ],
    split: [
      { pt: "PayPayポイント", rate: 1.0, note: "PayPayでのお店決済分（PayPay Step達成時）" }
    ],
    rate: 1.0,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与。チャージ時・出金時のポイントではない）。平均残高70万円以上は微改善、70万円未満は改悪という報告あり。また2026年3月25日の規約改定で「通常利用の範囲を超える頻度・金額」でのチャージが禁止行為として明記されたため、短期間での大量入金・出金の繰り返しは避けること",
    howtoPrep: ["ワンバンク・ソフトバンクカード・PayPayの各アプリを用意する"],
    howtoFlow: [
      "IDARE残高でワンバンクにチャージする（入会・コード入力で300円ボーナス）",
      "ワンバンク残高でソフトバンクカードにチャージする",
      "ソフトバンクカードでPayPayにチャージする",
      "お店でPayPayとして支払う（PayPay Step達成月は還元率アップ）"
    ],
    atStore: { rate: "1.0%（この区間のみ。IDARE残高ボーナスは別途年率最大2.2%）", method: "PayPayで支払い（PayPay Step達成月）" },
    caution: "ソフトバンクカードは新規申込不可（LINEMO以外は店頭でのみ申込可）。PayPay Step未達成の月は1.0%が下がる可能性がある。IDAREは毎月の保有残高を一定に保つほどボーナス効率が良いため、出金するとその分ボーナス計算の基礎額が減る点に注意。"
  },
  idare_exit_suica: {
    id: "idare_exit_suica",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["モバイルSuica"],
    steps: ["モバイルSuica"],
    gains: [
      "IDARE→モバイルSuicaチャージ：0%（IDAREの価値はチャージ時の還元ではなく残高保有ボーナス。下記balanceBonus参照）"
    ],
    split: [],
    rate: 0,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与。チャージ時・出金時のポイントではない）。平均残高70万円以上は微改善、70万円未満は改悪という報告あり。また2026年3月25日の規約改定で「通常利用の範囲を超える頻度・金額」でのチャージが禁止行為として明記されたため、短期間での大量入金・出金の繰り返しは避けること",
    howtoPrep: ["モバイルSuicaアプリにIDAREを登録する（IDARE公式サイトの案内に従う）"],
    howtoFlow: ["IDARE残高でモバイルSuicaにチャージする（最低500円から）"],
    atStore: { rate: "0%（この区間のみ。IDARE残高ボーナスは別途年率最大2.2%）", method: "Suicaとして交通機関・お店で使う" },
    caution: "モバイルSuicaへのチャージはApple Pay非対応のため、Suicaアプリにカードを直接登録する必要がある。最低チャージ額は500円。"
  },
  idare_exit_amazongift: {
    id: "idare_exit_amazongift",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["Amazonギフト券"],
    steps: ["Amazonギフト券（Eメールタイプ）"],
    gains: [
      "IDARE→Amazonギフト券購入：0%（IDAREの価値はチャージ時の還元ではなく残高保有ボーナス。下記balanceBonus参照）"
    ],
    split: [],
    rate: 0,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与。チャージ時・出金時のポイントではない）。平均残高70万円以上は微改善、70万円未満は改悪という報告あり。また2026年3月25日の規約改定で「通常利用の範囲を超える頻度・金額」でのチャージが禁止行為として明記されたため、短期間での大量入金・出金の繰り返しは避けること",
    howtoPrep: ["Amazonの支払い方法設定でIDAREカード番号を登録する"],
    howtoFlow: ["IDARE残高でAmazonギフト券（Eメールタイプ）を必要な分だけ購入し、残高をきれいに使い切る"],
    atStore: { rate: "0%（この区間のみ。IDARE残高ボーナスは別途年率最大2.2%）", method: "Amazon・Amazon Pay対応サイトでの支払いに使う" },
    caution: "IDAREは出金（現金化）ができないカードなので、使い切りたい場合はAmazonギフト券（有効期限10年）での調整が便利。購入額を微調整すれば残高を0円にできる。"
  },
  // ===== IDAREの追加出口（公式ヘルプで確認：リアルカード／PayPay／楽天ペイ／d払い／Revolut） =====
  idare_exit_realcard: {
    id: "idare_exit_realcard",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["IDARE"],
    steps: ["お店・ネットでIDAREリアルカードとしてそのまま支払い"],
    gains: ["IDAREでの直接決済：0%（IDAREの価値は残高保有ボーナス。下記balanceBonus参照）"],
    split: [],
    rate: 0,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与）",
    howtoPrep: ["IDAREのリアルカードを発行する（発行手数料がかかる場合あり）"],
    howtoFlow: ["Visa加盟店でIDAREリアルカードをそのまま使う（Apple Pay/Google Pay非対応）"],
    atStore: { rate: "0%（この区間のみ。IDARE残高ボーナスは別途年率最大2.2%）", method: "IDAREリアルカードで直接支払う" },
    caution: "IDAREはApple Pay・Google Pay非対応。ガソリンスタンド・宿泊施設・公共料金など一部利用できない店舗がある。"
  },
  idare_exit_paypay_direct: {
    id: "idare_exit_paypay_direct",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["PayPay"],
    steps: ["PayPayに登録して支払い"],
    gains: ["IDARE→PayPay登録払い：0%（IDAREの価値は残高保有ボーナス。下記balanceBonus参照）"],
    split: [],
    rate: 0,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与）",
    howtoPrep: ["PayPayアプリの「支払い方法を追加する」→「PayPayカード以外のカードを追加」からIDAREを登録する"],
    howtoFlow: ["PayPayの「支払う」からIDARE経由で決済する（チャージ不要、都度IDARE残高から引き落とし）"],
    atStore: { rate: "0%（この区間のみ。IDARE残高ボーナスは別途年率最大2.2%）", method: "PayPayアプリでIDAREを選んで支払う" },
    caution: "ソフトバンクカード経由のワンバンクルートと違い、PayPay Step等の追加還元は付かない、単純な代理決済。"
  },
  idare_exit_rakutenpay_direct: {
    id: "idare_exit_rakutenpay_direct",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["楽天ペイ"],
    steps: ["楽天ペイに登録して支払い"],
    gains: ["IDARE→楽天ペイ登録払い：0%（IDAREの価値は残高保有ボーナス。下記balanceBonus参照）"],
    split: [],
    rate: 0,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与）",
    howtoPrep: ["楽天会員情報の「お支払い方法」からIDAREを新しいクレジットカードとして登録する"],
    howtoFlow: ["楽天ペイの「お支払い先」でIDAREを選択して決済する"],
    atStore: { rate: "0%（この区間のみ。IDARE残高ボーナスは別途年率最大2.2%）", method: "楽天ペイアプリでIDAREを選んで支払う" },
    caution: "楽天ペイ側の還元（楽天ポイント等）が別途付くかは要確認。"
  },
  idare_exit_dbarai: {
    id: "idare_exit_dbarai",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["d払い"],
    steps: ["d払いに登録して支払い"],
    gains: ["IDARE→d払い登録払い：0%（IDAREの価値は残高保有ボーナス。下記balanceBonus参照）"],
    split: [],
    rate: 0,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与）",
    howtoPrep: ["d払いアプリの支払い方法設定からIDAREを登録する"],
    howtoFlow: ["d払いでIDAREを選択して決済する"],
    atStore: { rate: "0%（この区間のみ。IDARE残高ボーナスは別途年率最大2.2%）", method: "d払いアプリでIDAREを選んで支払う" },
    caution: "d払い側の還元（dポイント等）が別途付くかは要確認。"
  },
  idare_exit_revolut: {
    id: "idare_exit_revolut",
    entryNode: "IDARE",
    entryLabel: "IDARE",
    pays: ["Revolut"],
    steps: ["Revolut"],
    gains: ["IDARE→Revolutチャージ：手数料1.7%が差し引かれる（IDAREの価値は残高保有ボーナス。下記balanceBonus参照）"],
    split: [],
    rate: -1.7,
    balanceBonus: "IDARE残高保有ボーナス：2026年7月からのランク制で年率最大2.2%（毎月の平均保有残高に対して付与）",
    howtoPrep: ["Revolutアプリをインストールする"],
    howtoFlow: ["IDARE残高でRevolutにチャージする（手数料1.7%が引かれる）", "Revolut残高をANA Pay等さらに別の用途に回す"],
    atStore: { rate: "-1.7%（手数料。IDARE残高ボーナスは別途年率最大2.2%）", method: "Revolut残高として使う" },
    caution: "IDARE→Revolutは手数料1.7%が差し引かれるため、他の出口（ワンバンク・Suica・Amazonギフト券・PayPay・楽天ペイ・d払いはいずれも手数料なし）より不利。海外通貨での利用など、Revolut自体を使いたい理由がある場合のみ検討。"
  },
  // ===== ワンバンクの追加出口（ソフトバンクカード以外） =====
  wanbank_exit_direct_registration: {
    id: "wanbank_exit_direct_registration",
    entryNode: "ワンバンク",
    entryLabel: "ワンバンク",
    pays: ["PayPay", "楽天ペイ", "d払い"],
    steps: ["PayPay／楽天ペイ／d払いのいずれかに登録して支払い"],
    gains: ["ワンバンク→PayPay／楽天ペイ／d払い登録払い：0%（ソフトバンクカードを挟まず直接登録できる）"],
    split: [],
    rate: 0,
    howtoPrep: ["PayPay／楽天ペイ／d払いのいずれかのアプリでワンバンクのカード番号を支払い方法として登録する"],
    howtoFlow: ["対応店舗でPayPay／楽天ペイ／d払いの支払い方法としてワンバンクを選んで決済する"],
    atStore: { rate: "0%（この区間のみ）", method: "PayPay／楽天ペイ／d払いのいずれかでワンバンクを選んで支払う" },
    caution: "ソフトバンクカード経由（PayPay Step等の追加還元あり）と違い、こちらは単純な代理決済で追加還元は基本つかない。ソフトバンクカードを持っていない・作れない場合の代替手段として使う。"
  },
  // ===== nanaco→スマホプリペイド→バニラVISAの先にSuicaへ繋ぐ拡張版 =====
  nanaco_smaho_prepaid_suica: {
    id: "nanaco_smaho_prepaid_suica",
    entryNode: "モバイルnanaco",
    entryLabel: "モバイルnanaco",
    pays: ["モバイルSuica"],
    steps: [
      "スマホプリペイド",
      "バニラVISA（Visa eギフト）",
      "モバイルSuica"
    ],
    gains: [
      "モバイルnanaco→スマホプリペイドチャージ：0.5%",
      "スマホプリペイド→バニラVISAチャージ：1.5%",
      "バニラVISA→モバイルSuicaチャージ：0%（500円以上・1回の上限20,000円）"
    ],
    split: [
      { pt: "ポイント", rate: 0.5, note: "モバイルnanaco→スマホプリペイドチャージ分" },
      { pt: "ポイント", rate: 1.5, note: "スマホプリペイド→バニラVISAチャージ分" }
    ],
    rate: 2.0,
    howtoPrep: [
      "nanacoアプリ（モバイルnanaco）をインストールする",
      "スマホプリペイドアプリをインストールする",
      "バニラVISA（Visa eギフト）を購入・チャージする",
      "モバイルSuicaアプリを用意する"
    ],
    howtoFlow: [
      "モバイルnanaco残高でスマホプリペイドにチャージする",
      "スマホプリペイド残高でバニラVISA（Visa eギフト）にチャージする",
      "Suicaアプリの「登録クレジットカード情報変更」でバニラVISAの番号・有効期限・セキュリティコードを入力してチャージする（500円以上、1回20,000円まで）"
    ],
    atStore: { rate: "2.0%（この区間のみ）", method: "Suicaとして交通機関・お店で使う" },
    caution: "モバイルnanaco・スマホプリペイド・バニラVISAそれぞれに月間チャージ上限がある場合がある。バニラVISA→Suicaは500円未満・端数はチャージできないため、使い切りにはAmazonギフト券併用がおすすめ。"
  },
  // ===== ANA Pay以降の楽天キャッシュを使わない簡易版（月1万円上限を使い切った後の代替） =====
  edy_direct: {
    id: "edy_direct",
    entryNode: "ANA Pay",
    entryLabel: "ANA Pay",
    pays: ["楽天Edy"],
    steps: ["お店で楽天Edyとして支払い"],
    gains: ["ANA Pay→楽天Edyチャージ：ANAマイル0.5%", "楽天Edyでのお店決済：0%"],
    split: [
      { pt: "ANAマイル", rate: 0.5, note: "ANA Pay→楽天Edyチャージ分" }
    ],
    rate: 0.5,
    howtoPrep: ["ANA Pay・楽天ペイ（楽天Edy）の各アプリをインストールする"],
    howtoFlow: ["ANA Payで楽天Edyにチャージする", "お店で楽天Edyとしてそのまま支払う（楽天キャッシュへは移さない）"],
    atStore: { rate: "0.5%（この区間のみ）", method: "楽天Edyとして直接支払う" },
    caution: "楽天キャッシュの月1万円上限を使い切った後や、手順を減らしたい場合の簡易版。楽天キャッシュ経由（edy_cash_payセグメント）より合計還元率は低い。"
  },
  // カードから楽天Edyへ直接チャージする版（ANA Payを経由しない）
  edy_direct_from_card: {
    id: "edy_direct_from_card",
    entryNode: "楽天Edy",
    entryLabel: "楽天Edy",
    pays: ["楽天Edy"],
    steps: ["お店で楽天Edyとして支払い"],
    gains: ["楽天Edyでのお店決済：0%"],
    split: [],
    rate: 0,
    howtoPrep: ["楽天ペイ（楽天Edy）アプリをインストールする"],
    howtoFlow: ["お店で楽天Edyとしてそのまま支払う"],
    atStore: { rate: "0%（この区間のみ）", method: "楽天Edyとして直接支払う" },
    caution: "カードから楽天Edyへ直接チャージする方式。ANA Payを経由するedy_directとは別ルート。"
  }
};

// chain: starter からセグメントの entryNode に到達するまでの全ホップを「entryNodeを含めて」順番に並べたもの。
// 各要素の rate はそのホップ単体の還元率（starterから見て初回のホップ含む）。
// chain の rate 合計が connector.rate（starter→entryNode の合計還元率）と一致する。
// 最後の要素の label は必ずそのセグメントの entryNode と同じにする（自動でノードの重複を避けるため）。
const ROUTE_CONNECTORS = [
  {
    starter: "V NEOBANKデビット",
    rate: 1.5,
    segment: "edy_cash_pay",
    chain: [
      { label: "au PAY", rate: 1.5, note: "上限5万円/月" },
      { label: "ANA Pay", rate: 0, note: "au PAYは経由してもしなくても還元率は同じ" }
    ],
    starterNote: "V NEOBANKデビット（住信SBI・年会費無料・審査なし・1.5%）。⚠️ 2026年11月1日からチャージポイントが0%になる予定のため、11月以降は同じ表の「カテエネBANKデビット」に切り替えてください。",
    shutdownWarn: "⚠️ 2026年10月31日で終了予定。2026年11月1日からV NEOBANKのチャージポイントが0%になります。",
    caution: "V NEOBANKデビットは2026年11月1日からチャージ還元が対象外になる予定。",
    prep: ["住信SBIネット銀行でV NEOBANK口座を開設し、デビットを発行する"]
  },
  {
    starter: "カテエネBANKデビット",
    rate: 2.0,
    segment: "edy_cash_pay",
    chain: [
      { label: "au PAY", rate: 2.0, note: "月末残高200万円条件" },
      { label: "ANA Pay", rate: 0, note: "au PAYは経由してもしなくても還元率は同じ" }
    ],
    starterNote: "カテエネBANKデビット（住信SBIネット銀行・中部電力契約不要・月末残高200万円で2.0%）。V NEOBANKデビットの11月以降の代替としても使え、合計還元率もこちらの方が高くなります。",
    caution: "月末残高200万円を維持できないとカテエネポイントの還元率が下がる可能性がある。",
    prep: ["カテエネBANKの口座を開設し、デビットカードを発行する"]
  },
  {
    starter: "三井住友NL G／Olive G",
    rate: 1.5,
    segment: "edy_cash_pay",
    chain: [
      { label: "Revolut", rate: 1.5, note: "年間100万円利用条件" },
      { label: "ANA Pay", rate: 0, note: "経由地としての利用" }
    ],
    starterNote: "三井住友カード（NL）ゴールド／Oliveゴールド（年会費条件付き無料。年間100万円以上の利用でRevolutチャージ還元1.5%になる想定）。",
    caution: "年間100万円利用の条件を満たさないと1.5%が適用されない可能性がある。",
    routeLabel: "三井住友NL Gルート",
    prep: ["三井住友カード（NL）ゴールドまたはOliveゴールドを発行する"]
  },
  {
    // 2026年8月1日より、エポスカード／エポスゴールド／JQ CARDエポスゴールドは
    // ANA Pay・au PAY・楽天Edy・Kyash・IDARE等へのチャージ通常還元（0.5%）が終了。
    // ただしチャージ額は引き続き年間利用額としてカウントされ、年間ボーナス
    // （100万円達成で10,000pt＝1.0%相当、50万円達成で2,500pt＝0.5%相当）の対象にはなる。
    starter: "エポスGカード（年間100万円達成）",
    rate: 1.0,
    segment: "edy_cash_pay",
    chain: [
      { label: "ANA Pay", rate: 1.0, note: "年間100万円利用達成時のボーナス換算（10,000pt）。2026/8/1〜通常のチャージ還元0.5%は終了、年間利用額カウントのみ継続" }
    ],
    starterNote: "エポスゴールドカード／JQ CARDエポスゴールド（年会費条件付き無料）。年間100万円以上の利用で10,000ポイント（＝1.0%相当）のボーナスが付く。2026年8月1日からチャージ自体の通常還元（0.5%）は終了したが、チャージ額は引き続き年間利用額としてカウントされる。",
    caution: "2026年8月1日からANA Pay・au PAY・楽天Edy・Kyash・IDARE等へのチャージの通常還元（0.5%）は終了済み。この1.0%はあくまで年間100万円達成時の年間ボーナス換算であり、チャージの都度もらえるポイントではない点に注意。",
    citation: "［情報源：カードレビューズ「チャージのポイント還元が対象外のカード一覧」、おうちでお金を育てる暮らし「ANA Payチャージでポイント・マイル二重取り」／確認日: 2026-08-26・要最新確認］",
    routeLabel: "エポスGルート（年間100万円達成）",
    prep: ["エポスゴールドカード／JQ CARDエポスゴールドを発行する", "年間利用額100万円を達成する"]
  },
  {
    starter: "エポスGカード（年間50万円達成）",
    rate: 0.5,
    segment: "edy_cash_pay",
    chain: [
      { label: "ANA Pay", rate: 0.5, note: "年間50万円利用達成時のボーナス換算（2,500pt）。2026/8/1〜通常のチャージ還元0.5%は終了、年間利用額カウントのみ継続" }
    ],
    starterNote: "エポスゴールドカード／JQ CARDエポスゴールド（年会費条件付き無料）。年間50万円以上100万円未満の利用で2,500ポイント（＝0.5%相当）のボーナスが付く。",
    caution: "2026年8月1日からANA Pay・au PAY・楽天Edy・Kyash・IDARE等へのチャージの通常還元（0.5%）は終了済み。この0.5%はあくまで年間50万円達成時の年間ボーナス換算であり、チャージの都度もらえるポイントではない点に注意。",
    citation: "［情報源：カードレビューズ「チャージのポイント還元が対象外のカード一覧」、おうちでお金を育てる暮らし「ANA Payチャージでポイント・マイル二重取り」／確認日: 2026-08-26・要最新確認］",
    routeLabel: "エポスGルート（年間50万円達成）",
    prep: ["エポスゴールドカード／JQ CARDエポスゴールドを発行する", "年間利用額50万円を達成する"]
  },
  {
    starter: "エポスGカード（年間100万円達成）",
    rate: 1.0,
    segment: "edy_direct_from_card",
    chain: [
      { label: "楽天Edy", rate: 1.0, note: "年間100万円利用達成時のボーナス換算（10,000pt）。ANA Payを経由せず直接楽天Edyへチャージする版" }
    ],
    starterNote: "エポスゴールドカード／JQ CARDエポスゴールド。楽天キャッシュの月間上限を気にせず使いたい場合の簡易ルート。",
    caution: "2026年8月1日からのチャージ通常還元終了・年間ボーナス換算である点は同上。楽天Edyでの店舗決済自体には別途還元はつかない。",
    routeLabel: "エポスGルート（Edy直接・年間100万円達成）",
    prep: ["エポスゴールドカード／JQ CARDエポスゴールドを発行する", "年間利用額100万円を達成する"]
  }
];

// ===== Kyash・バンドルカードで「使えなくなった」チャージ経路（2024年に封鎖済み） =====
// エポス→Kyashのように、Kyash自体は使える（残高として店舗で利用可）が、
// そこから先のANA Pay・IDAREへの転送は塞がれているため、単独の終端ルートとして扱う。
const KYASH_BANDLE_DEADEND_NOTE =
  "Kyash・バンドルカードはどちらも2024年にANA Pay・IDAREへのチャージルートが封鎖されています" +
  "（Kyash→ANA Pay/IDARE：2024年3月21日終了、バンドルカード→ANA Pay/IDARE：2024年4月24日終了）。" +
  "そのため現在はKyash・バンドルカード自体の残高として店舗で使うか、対応している他の入金先（バンドルカードの場合はVポイントPayなど）に限定されます。";

const STANDALONE_ROUTES_EXTRA = [
  {
    name: "エポスGカード → Kyash",
    pays: ["Kyash"],
    total: "合計 1.0%（年間100万円達成時のボーナス換算のみ）",
    steps: ["エポスGカード（年間100万円達成）", "Kyash", "お店でKyashとして支払い"],
    gains: [
      "エポスGカード→Kyashチャージ：年間100万円達成時のボーナス換算1.0%（2026/8/1〜通常のチャージ還元0.5%は終了）",
      "Kyashでのお店決済：Kyash側の基本還元（変動あり、要確認）"
    ],
    split: [
      { pt: "ポイント", rate: 1.0, note: "エポスGカード年間ボーナス換算分" }
    ],
    starter: "エポスゴールドカード／JQ CARDエポスゴールド（年間100万円達成）。",
    howto: {
      prep: ["エポスゴールドカード／JQ CARDエポスゴールドを発行する", "Kyashアプリをインストールする"],
      flow: ["エポスGカードでKyashにチャージする", "お店でKyash Visaカードとして支払う"],
      time: "カード発行に1〜2週間"
    },
    note: `${KYASH_BANDLE_DEADEND_NOTE}［情報源：各種Kyash改悪関連記事／確認日: 2026-08-26・要最新確認］`,
    url: null,
    caution: "KyashからANA Pay・IDAREへは2024年からチャージ不可。Kyash自体の店舗決済還元率は別途確認が必要。",
    atStore: { rate: "1.0%（エポスG側の年間ボーナス換算のみ）", method: "Kyash Visaカードとして支払う" },
    starters: { "エポスGカード（年間100万円達成）": 1.0 }
  }
  // 【ファミペイ→バンドルカード→VポイントPay ルート 削除】
  // 「Z家のお得メモ」チャージルート記録で確認：2025年6月1日からFamiPay→バンドルカードの
  // チャージ自体が不可になっている（4/16からのボーナス対象外に続き、完全に封鎖）。
  // ROUTE_EXCLUSIONSに記録し、ここでは掲載しない。
];

const ROUTE_CONNECTORS_EXTRA_1 = [
  {
    starter: "JQCARDセゾンG",
    rate: 1.5,
    segment: "edy_cash_pay",
    chain: [
      { label: "au PAY", rate: 1.5, note: "年間100万円利用条件" },
      { label: "ANA Pay", rate: 0, note: "au PAYは経由してもしなくても還元率は同じ" }
    ],
    starterNote: "JQCARDセゾンG（年間100万円以上の利用でau PAYチャージ還元1.5%になる想定。未達成の年はエポスGカード版と同程度に下がる可能性）。",
    caution: "年間100万円利用の条件を満たさないと1.5%が適用されない可能性がある。",
    routeLabel: "JQセゾンGルート",
    prep: ["JQCARDセゾンGを発行する"]
  },
  // 【PayPayカード→Revolut connector 削除】
  // 2026/6/2からPayPayカードは「他社決済へのチャージ」がポイント付与対象外になったため、
  // Revolutは「他社決済サービス」に該当し、このルートは機能しなくなった可能性が高い。
  // ROUTE_EXCLUSIONSに記録し、ここでは生成しない。
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "edy_cash_pay",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "ANA Pay", rate: 0.1, note: "au PAYを経由しても可（0%・経由してもしなくても同じ）。1回2万円以下のチャージは一時停止中（20,001円以上のみ可・2025/4/30〜）。1日10万円・月30万円まで" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "nanaco・JQセゾン(JCB)ルート",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Payの各アプリをインストールする"],
    note: "「nanaco」の名がついたルートですが、この経路自体はANA Pay側を通るバージョンです。同じ起点からnanaco・スマホプリペイド経由で行く別バージョンも合計3.6%になります（同じ表の別ルート参照）。"
  },
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "nanaco_smaho_prepaid",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "モバイルnanaco", rate: 0.1, note: "au PAYを経由しても可（0%・経由してもしなくても同じ）" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "nanaco・JQセゾン(JCB)ルート",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Payの各アプリをインストールする"],
    note: "上のANA Pay経由バージョンと起点（JQセゾン(JCB)→ファミペイ→JAL Pay）までは共通で、JAL Payから先でnanaco・スマホプリペイド経由に分かれるルートです。合計はどちらも3.6%になります。"
  },
  {
    starter: "カテエネBANKデビット",
    rate: 2.0,
    segment: "nanaco_smaho_prepaid",
    chain: [
      { label: "モバイルnanaco", rate: 2.0, note: "月末残高200万円条件" }
    ],
    starterNote: "カテエネBANKデビット（住信SBIネット銀行・中部電力契約不要・月末残高200万円で2.0%）。",
    caution: "月末残高200万円を維持できないとカテエネポイントの還元率が下がる可能性がある。",
    routeLabel: null,
    prep: ["カテエネBANKの口座を開設し、デビットカードを発行する"]
  },
  {
    starter: "住信SBIデビットカード Point+",
    rate: 1.25,
    segment: "nanaco_smaho_prepaid",
    chain: [
      { label: "モバイルnanaco", rate: 1.25, note: "iPhone限定" }
    ],
    starterNote: "住信SBIデビットカード Point+（住信SBIネット銀行・Mastercard・モバイルnanacoへのチャージで1.25%）。",
    caution: "モバイルnanacoへのチャージ還元はiPhone限定です。Androidでは還元率が変わる可能性があります。",
    routeLabel: null,
    prep: ["住信SBIネット銀行で住信SBIデビットカード Point+を発行する"]
  },
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "idare_exit_wanbank",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "IDARE", rate: 0.1, note: "" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "ワンバンクルート",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Payの各アプリをインストールする"],
    note: "IDAREはチャージ時の還元ではなく残高保有ボーナス（年率最大2.2%）が本体です。ワンバンク以外にモバイルSuica・Amazonギフト券への出口もあります（同じ表の別ルート参照）。"
  },
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "idare_exit_suica",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "IDARE", rate: 0.1, note: "" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "IDARE→Suica出口",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Payの各アプリをインストールする"],
    note: "普段電車でSuicaを使う人向けの出口です。IDAREの本体価値は残高保有ボーナス（年率最大2.2%）で、この区間自体のチャージ還元は0%です。"
  },
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "idare_exit_amazongift",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "IDARE", rate: 0.1, note: "" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "IDARE→Amazonギフト券出口",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Payの各アプリをインストールする"],
    note: "しばらく使わない・残高をきれいに使い切りたいときの出口です。IDAREの本体価値は残高保有ボーナス（年率最大2.2%）で、この区間自体のチャージ還元は0%です。"
  },
  // ===== ここから Revolut を経由するルート（△含む） =====
  {
    starter: "住信SBIデビットカード Point+",
    rate: 1.25,
    segment: "edy_cash_pay",
    chain: [
      { label: "Revolut", rate: 1.25, note: "Mastercard・手数料無料。スマートプログラムのランクに応じ最大2.0%" },
      { label: "ANA Pay", rate: 0, note: "経由地としての利用" }
    ],
    starterNote: "住信SBIデビットカード Point+（Mastercard・年会費無料）。Revolutへのチャージでポイント付与を確認済み（基本1.25%、スマートプログラムのランク次第で最大2.0%）。",
    routeLabel: "住信SBIデビット Point+ルート（Revolut経由）",
    prep: ["住信SBIネット銀行で住信SBIデビットカード Point+を発行する", "Revolut・ANA Payの各アプリをインストールする"],
    citation: "［情報源：Revolutチャージルート解説記事（デビットカード Point+のチャージ還元を確認）／確認日: 2026-08-26・要最新確認］"
  },
  {
    starter: "住信SBIプラチナデビット",
    rate: 1.25,
    segment: "edy_cash_pay",
    chain: [
      { label: "Revolut", rate: 1.25, note: "Mastercard・手数料無料。年会費11,000円。ランク次第で最大2.5%" },
      { label: "ANA Pay", rate: 0, note: "経由地としての利用" }
    ],
    starterNote: "住信SBIプラチナデビット（Mastercard・年会費11,000円）。Revolutへのチャージでポイント付与を確認済み（基本1.25%、ランク次第で最大2.5%）。年会費がかかる分、還元額とのバランスを確認してから発行してください。",
    caution: "年会費11,000円がかかる。年間の利用額・還元額が年会費を上回るか事前に試算することをおすすめします。",
    routeLabel: "住信SBIプラチナデビットルート（Revolut経由）",
    prep: ["住信SBIネット銀行で住信SBIプラチナデビットを発行する（年会費11,000円）", "Revolut・ANA Payの各アプリをインストールする"]
  },
  {
    starter: "三菱UFJカード",
    rate: 0.5,
    segment: "edy_cash_pay",
    chain: [
      { label: "ANA Pay", rate: 0.5, note: "Visa／Mastercardブランド限定" }
    ],
    starterNote: "三菱UFJカード（Visa／Mastercardブランド限定）。ANA Payへの直接チャージで還元を確認済み（基本還元率0.5%相当）。",
    caution: "三菱UFJカードはJAL Payとau PAYへのチャージがポイントプログラムの対象外と明記されているため、この2つは使わないこと。ANA Payへは直接チャージし、Revolutを経由する必要はない（Revolutチャージでの還元は確認できていない）。",
    routeLabel: "三菱UFJカードルート（ANA Pay直接）",
    prep: ["三菱UFJカード（Visa／Mastercardブランド）を発行する", "ANA Payアプリをインストールする"],
    citation: "［情報源：三菱UFJカード活用ブログ（ANA Payチャージの還元・JAL Pay/au PAY対象外を確認）／確認日: 2026-08-26・要最新確認］"
  },
  {
    starter: "V NEOBANKデビット",
    rate: 1.5,
    segment: "edy_cash_pay",
    chain: [
      { label: "Revolut", rate: 1.5, note: "Visaデビット・手数料無料" },
      { label: "ANA Pay", rate: 0, note: "経由地としての利用" }
    ],
    starterNote: "V NEOBANKデビット（Visaデビット・手数料無料でRevolutにチャージ可）。au PAY経由ルートと同じ起点だが、au PAYの月5万円上限を使い切った後の追加ルートとして使える。",
    caution: "△ Revolutチャージでのポイント付与を明確に確認できた情報源が見つかっていません。au PAY経由ルート（既存）の方が実績があるため、まずはそちらを優先してください。⚠️ 2026年11月1日からチャージポイントが0%になる予定。",
    shutdownWarn: "⚠️ 2026年10月31日で終了予定。2026年11月1日からV NEOBANKのチャージポイントが0%になります。",
    routeLabel: "クレカなしルート（Revolut経由・要確認）",
    prep: ["住信SBIネット銀行でV NEOBANK口座を開設し、デビットを発行する", "Revolut・ANA Payの各アプリをインストールする"]
  },
  {
    starter: "カテエネBANKデビット",
    rate: 2.0,
    segment: "edy_cash_pay",
    chain: [
      { label: "Revolut", rate: 2.0, note: "Visaデビット・手数料無料・月末残高200万円条件" },
      { label: "ANA Pay", rate: 0, note: "経由地としての利用" }
    ],
    starterNote: "カテエネBANKデビット（Visaデビット・手数料無料でRevolutにチャージ可）。au PAY経由ルートと同じ起点だが、au PAYの月5万円上限を使い切った後の追加ルートとして使える。",
    caution: "△ Revolutチャージでのポイント付与を明確に確認できた情報源が見つかっていません。au PAY経由ルート（既存）の方が実績があるため、まずはそちらを優先してください。",
    routeLabel: "クレカなしルート（Revolut経由・要確認）",
    prep: ["カテエネBANKの口座を開設し、デビットカードを発行する", "Revolut・ANA Payの各アプリをインストールする"]
  },
  {
    starter: "楽天カード",
    rate: 1.0,
    segment: "edy_cash_pay",
    chain: [
      { label: "Revolut", rate: 1.0, note: "Mastercardブランドを選択すると手数料無料" },
      { label: "ANA Pay", rate: 0, note: "経由地としての利用" }
    ],
    starterNote: "楽天カード（Mastercardブランドを選ぶとRevolut手数料無料）。通常還元1%が基本線で、日曜日など楽天ポイント倍率アップの日に合わせるとさらに上乗せできる可能性がある。",
    caution: "△ Revolutチャージでの還元率について確度の高い一次情報が見つかっていません。1%は通常のカード利用還元からの推測値です。実際にチャージしてポイント付与明細を確認してから本格運用してください。",
    routeLabel: "楽天カードルート（Revolut経由・要確認）",
    prep: ["楽天カード（Mastercardブランド）を発行する", "Revolut・ANA Payの各アプリをインストールする"]
  }
];

// ===== 新しい出口セグメント用のコネクタ =====
const ROUTE_CONNECTORS_EXTRA_2 = [
  // IDAREの各出口（リアルカード／PayPay／楽天ペイ／d払い／Revolut）
  ...["idare_exit_realcard", "idare_exit_paypay_direct", "idare_exit_rakutenpay_direct", "idare_exit_dbarai", "idare_exit_revolut"].map(seg => ({
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: seg,
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "IDARE", rate: 0.1, note: "" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: {
      idare_exit_realcard: "IDARE→リアルカード出口",
      idare_exit_paypay_direct: "IDARE→PayPay登録出口",
      idare_exit_rakutenpay_direct: "IDARE→楽天ペイ登録出口",
      idare_exit_dbarai: "IDARE→d払い登録出口",
      idare_exit_revolut: "IDARE→Revolut出口（手数料1.7%）"
    }[seg],
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Payの各アプリをインストールする"],
    note: "IDAREの本体価値は残高保有ボーナス（年率最大2.2%）です。この区間自体のチャージ・決済還元は基本0%（Revolut出口のみ手数料1.7%のマイナス）。"
  })),
  // ワンバンクへの直接登録出口（ソフトバンクカードを挟まない版）
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "wanbank_exit_direct_registration",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "IDARE", rate: 0.1, note: "" },
      { label: "ワンバンク", rate: 0, note: "IDARE残高ボーナスとは別枠。単純な出金先" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "ワンバンクルート（PayPay/楽天ペイ/d払いに直接登録・ソフトバンクカード不要版）",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Payの各アプリをインストールする"],
    note: "ソフトバンクカードを持っていない・作れない場合は、ワンバンクのカード番号をPayPay／楽天ペイ／d払いに直接登録して支払う方法もあります（PayPay Step等の追加還元は付きません）。"
  },
  // nanaco→スマホプリペイド→バニラVISA→Suicaの拡張版
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "nanaco_smaho_prepaid_suica",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "モバイルnanaco", rate: 0.1, note: "au PAYを経由しても可（0%・経由してもしなくても同じ）" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "nanaco・JQセゾン(JCB)ルート（Suicaへ延長）",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Pay・nanaco（モバイルnanaco）・スマホプリペイドの各アプリをインストールする"],
    note: "普段Suicaで交通機関やお店を使う人向けに、バニラVISAからさらにSuicaへ繋いだ版です。合計還元率は元のバニラVISA止まり版と同じ3.6%です（Suicaへの最終チャージ自体は0%）。"
  },
  // JAL Pay→(au PAY)→ANA Pay→楽天Edy直接払い（楽天キャッシュの月1万円上限を使い切った後の簡易版）
  {
    starter: "JQセゾン(JCB)",
    rate: 1.6,
    segment: "edy_direct",
    chain: [
      { label: "ファミペイ", rate: 1.5, note: "月2万円まで" },
      { label: "JAL Pay", rate: 0, note: "1日10万円・月30万円まで（2024/6/6〜の上限）" },
      { label: "ANA Pay", rate: 0.1, note: "au PAYを経由しても可（0%・経由してもしなくても同じ）。1回2万円以下のチャージは一時停止中（20,001円以上のみ可・2025/4/30〜）。1日10万円・月30万円まで" }
    ],
    starterNote: "JQセゾン(JCB)（ファミペイチャージで1.5%・月2万円まで）。楽天カードやPayPayカードなど、ファミペイにチャージできる他のカードでも起点にでき、その場合は還元率が変わります（starters参照）。",
    starterAlts: { "楽天カード": 1.1, "PayPayカード": 0.6 },
    routeLabel: "nanaco・JQセゾン(JCB)ルート（Edy直接払い・簡易版）",
    prep: ["JQセゾン(JCB)（または楽天カード／PayPayカードなど、ファミペイにチャージできるカード）を用意する", "ファミペイ・JAL Pay・ANA Pay・楽天ペイ（楽天Edy）の各アプリをインストールする"],
    note: "楽天キャッシュの月1万円上限を使い切った後や、手順を減らしたい場合の簡易版です。合計還元率はANA Pay→楽天Edy→楽天キャッシュ→楽天Pay版（3.6%）より低くなります。"
  },
  {
    starter: "V NEOBANKデビット",
    rate: 1.5,
    segment: "edy_direct",
    chain: [
      { label: "au PAY", rate: 1.5, note: "上限5万円/月" },
      { label: "ANA Pay", rate: 0, note: "au PAYは経由してもしなくても還元率は同じ" }
    ],
    starterNote: "V NEOBANKデビット（住信SBI・年会費無料・審査なし・1.5%）。⚠️ 2026年11月1日からチャージポイントが0%になる予定。",
    shutdownWarn: "⚠️ 2026年10月31日で終了予定。2026年11月1日からV NEOBANKのチャージポイントが0%になります。",
    routeLabel: "クレカなしルート（Edy直接払い・簡易版）",
    prep: ["住信SBIネット銀行でV NEOBANK口座を開設し、デビットを発行する", "au PAY・ANA Pay・楽天ペイ（楽天Edy）の各アプリをインストールする"],
    note: "楽天キャッシュの月1万円上限を使い切った後や、手順を減らしたい場合の簡易版です。"
  }
];

// ===== 試したが使えなかった／対象外だった組み合わせの記録 =====
// ここは buildRoutesFromConnectors() には一切渡さない。ルート生成用のROUTE_CONNECTORSとは
// 別枠にすることで、「使えない」情報が誤って有効なルートとして生成されるのを防ぐ。
// UIに出す場合も「使えるルート一覧」とは別セクション（例：注意書き）として表示すること。
const ROUTE_EXCLUSIONS = [
  {
    from: "三菱UFJカード",
    to: "JAL Pay",
    reason: "三菱UFJカードはJAL Payへのチャージがポイントプログラムの対象外と明記されている",
    checkedDate: "2026-08-26",
    source: "small-hack.com「三菱UFJカードのポイントアップ活用」",
    caution: "カード会社の規約は変更されることがあるため、時期により対象外リストが変わる可能性がある。要最新確認。"
  },
  {
    from: "三菱UFJカード",
    to: "au PAY",
    reason: "三菱UFJカードはau PAYへのチャージもポイントプログラムの対象外と明記されている",
    checkedDate: "2026-08-26",
    source: "small-hack.com「三菱UFJカードのポイントアップ活用」",
    caution: "カード会社の規約は変更されることがあるため、時期により対象外リストが変わる可能性がある。要最新確認。"
  },
  {
    from: "リクルートカード",
    to: "Revolut",
    reason: "Revolutへのチャージ自体にポイントが付与されないと情報源で確認",
    checkedDate: "2026-08-26",
    source: "IPOで稼ぐメカニックの株ログ「Revolutチャージにおすすめのクレジットカード」",
    caution: "要最新確認。"
  },
  {
    from: "Kyash",
    to: "ANA Pay",
    reason: "2024年3月21日にKyashからANA Payへのチャージ機能が終了（公式アナウンス済み）",
    checkedDate: "2026-08-26",
    source: "Kyash公式アナウンス／アプリオ・節約速報など複数メディア",
    caution: "サービス仕様のため復活の可能性は低いが、念のため要最新確認。"
  },
  {
    from: "Kyash",
    to: "IDARE",
    reason: "2024年3月21日にKyashからIDAREへのチャージ機能が終了（公式アナウンス済み）",
    checkedDate: "2026-08-26",
    source: "Kyash公式アナウンス／アプリオ・節約速報など複数メディア",
    caution: "サービス仕様のため復活の可能性は低いが、念のため要最新確認。"
  },
  {
    from: "バンドルカード",
    to: "ANA Pay",
    reason: "2024年4月24日にバンドルカードからANA Payへのチャージ機能が終了",
    checkedDate: "2026-08-26",
    source: "朝から昼寝「バンドルカード→ANA Payのチャージも4/24で不可に」など",
    caution: "要最新確認。"
  },
  {
    from: "バンドルカード",
    to: "IDARE",
    reason: "2024年4月24日にバンドルカードからIDAREへのチャージ機能が終了",
    checkedDate: "2026-08-26",
    source: "朝から昼寝「バンドルカード→ANA Payのチャージも4/24で不可に」など",
    caution: "要最新確認。"
  },
  {
    from: "ファミペイ",
    to: "バンドルカード",
    reason: "2024年4月16日にボーナス付与対象外、2025年6月1日に「チャージ不可」との情報あり。ただし2026年3月3日付の別の記事では、ファミリーマート店頭でバンドルカードのチャージ用申込券を発行しファミペイ残高で支払う方法により、実際にチャージ成功＆10円のキャッシュバックを確認したとの報告があり、情報が矛盾している",
    checkedDate: "2026-08-26",
    source: "Z家のお得メモ「チャージルート関係の記録」https://toyama-go-z-house.com/log/ ／ uni928「ファミペイでバンドルカードに1000円チャージすると、なぜか10円還元された話」https://note.com/uni928928/n/n677c90ae094c（2026年3月3日）",
    caution: "情報源同士が矛盾しているため「使えない」と断定はできない。ただし還元があったとしても定額10円/件程度（公共料金等の収納代行系支払いに適用される「10ファミマポイント/件」の仕組みと同一とみられ、%ベースではない）で、以前言われていた「最大3%」という情報の根拠にはならない。実施前に必ず自分でファミリーマート店頭で少額チャージを試し、レシートの還元有無の注釈を確認すること。"
  },
  {
    from: "PayPayカード",
    to: "Revolut（他社決済サービス全般）",
    reason: "2026年6月2日からPayPayカードは「他社決済サービスへのチャージ」がポイント付与対象外になった（あわせて公共料金の還元率も0.5%に低下）。Revolutも他社決済サービスに該当するため、対象になっている可能性が高い",
    checkedDate: "2026-08-26",
    source: "Z家のお得メモ「チャージルート関係の記録（ルール変更など）」https://toyama-go-z-house.com/log/",
    caution: "既存の「PayPayカード → Revolut → ANA Pay → 楽天Edy → 楽天Pay」ルートの起点（1.0%）はこの改悪で成立しなくなった可能性が高い。ルート自体はサイトに残しているが、実施前に必ずPayPayカードの最新の対象外サービス一覧を確認すること。"
  }
];

// コネクタ×セグメントを、これまでの手書きルートと同じ形（steps/gains/split/atStore等）に組み立てる。
// 出力の形が変わらないので、ここより後ろのコード（描画・お気に入り・編集機能など）は無改修で動く。
function fmtRate(n){
  // toFixed(1)だと1.25%が1.3%に丸まってしまうので、末尾の0だけ落とす方式にする
  const s = n.toFixed(2);
  return s.replace(/0$/, "").replace(/\.$/, "");
}
function buildRoutesFromConnectors(connectors, segments){
  return connectors.map(c => {
    const seg = segments[c.segment];
    const chain = c.chain; // 最後の要素の label === seg.entryNode になっている前提
    const chainLabels = chain.map(h => h.label);
    // ルート名（タイトル）には「お店で〜支払い」のような最終行動ステップは含めない
    const titleSteps = seg.steps.filter(s => !s.startsWith("お店で")).map(s => s.split("（")[0]);
    const nameChain = [c.starter, ...chainLabels, ...titleSteps].join(" → ");
    const name = c.routeLabel ? `${nameChain}（${c.routeLabel}）` : nameChain;

    const segRateNum = typeof seg.rate === "number" ? seg.rate : 0;
    const totalNum = c.rate + segRateNum;
    const totalStr = seg.rateSuffix
      ? `合計 ${fmtRate(totalNum)}%${seg.rateSuffix}`
      : `合計 ${fmtRate(totalNum)}%`;

    const chainGains = chain.map((h, idx) => {
      const from = idx === 0 ? c.starter : chain[idx - 1].label;
      const noteStr = h.note ? `（${h.note}）` : "";
      return `${from}→${h.label}チャージ：${fmtRate(h.rate)}%${noteStr}`;
    });
    const gains = [...chainGains, ...seg.gains];

    const chainSplit = chain
      .filter(h => h.rate > 0)
      .map(h => {
        const idx = chain.indexOf(h);
        const from = idx === 0 ? c.starter : chain[idx - 1].label;
        return { pt: "ポイント", rate: h.rate, note: `${from}→${h.label}チャージ分${h.note ? "（" + h.note + "）" : ""}` };
      });
    const split = [...chainSplit, ...seg.split];

    const prepList = [...(c.prep || []), ...(seg.howtoPrep || [])];
    const chainFlow = chain.map((h, idx) => {
      const from = idx === 0 ? c.starter : chain[idx - 1].label;
      return `${h.label}に${from}からチャージする${h.note ? "（" + h.note + "）" : ""}`;
    });
    const flowList = [...chainFlow, ...seg.howtoFlow];

    // 2026-08-31: 「ユーザー提供の路線図画像」を出典とする一律の注記は、
    // 運営者が個別に裏取りした結果、内容が不正確だったことが判明したため廃止した。
    // 個別に信頼できる出典（c.citation）が設定されているコネクタだけ、その出典を表示する。
    const noteParts = [
      c.note,
      seg.balanceBonus ? `［${seg.balanceBonus}］` : null,
      c.citation || null
    ].filter(Boolean);

    const cautionParts = [c.caution, seg.caution].filter(Boolean);

    const startersObj = { [c.starter]: c.rate };
    if (c.starterAlts) Object.assign(startersObj, c.starterAlts);

    const route = {
      name,
      pays: seg.pays,
      total: totalStr,
      steps: [c.starter, ...chainLabels, ...seg.steps],
      gains,
      split,
      starter: c.starterNote,
      howto: {
        prep: prepList,
        flow: flowList,
        time: "カード発行に数日〜2週間ほど。以降のチャージ操作は月10〜15分ほど"
      },
      note: noteParts.join(" "),
      url: null,
      caution: cautionParts.join(" "),
      atStore: {
        rate: totalStr.replace("合計 ", ""),
        method: seg.atStore.method
      },
      starters: startersObj
    };
    if (c.shutdownWarn) route.shutdownWarn = c.shutdownWarn;
    return route;
  });
}

const DEFAULT_ROUTES_GENERATED = buildRoutesFromConnectors(
  ROUTE_CONNECTORS.concat(ROUTE_CONNECTORS_EXTRA_1).concat(ROUTE_CONNECTORS_EXTRA_2),
  ROUTE_SEGMENTS
);

// 生成されたルートのうち、IDAREが主役のものには affKey を明示しておく。
// これがあると、affiliateFor（起点カード名のあいまい一致）より先に
// affiliateForKey（affiliates.jsonのキー完全一致）が優先され、
// 途中に出てくる他のカード名と誤って紐づく事故を防げる。
DEFAULT_ROUTES_GENERATED.forEach(r => {
  if(r.name.includes("IDARE")){
    r.affKey = "idare";
    if(!r.articleUrl) r.articleUrl = "articles/idare-card-katsuyo.html";
  }
  if(r.name.includes("スマホプリペイド")){
    if(!r.articleUrl) r.articleUrl = "articles/smaho-prepaid-toha.html";
  }
  // ANA Pay→楽天Edy→楽天キャッシュ→楽天ペイの流れは起点カードが何であっても
  // 同じ仕組み・同じ2026年8月改悪の影響を受けるため、起点カード違いの自動生成ルート全てに
  // 同じ解説記事を紐付ける（手書きの汎用ルート「ANA Pay → 楽天Edy → 楽天キャッシュ → 楽天ペイ」と同じ記事）。
  // ※自動生成ルート名は「楽天Pay」表記（seg.stepsの表記そのまま）になるため、両表記とも見る。
  if(r.name.includes("楽天Edy") && r.name.includes("楽天キャッシュ") && (r.name.includes("楽天Pay") || r.name.includes("楽天ペイ"))){
    if(!r.articleUrl) r.articleUrl = "articles/ana-pay-rakuten-edy-cash-route.html";
  }
});

const DEFAULT_ROUTES = DEFAULT_ROUTES_MANUAL.concat(DEFAULT_ROUTES_GENERATED).concat(STANDALONE_ROUTES_EXTRA);



const UNIVERSAL_PAYMENTS = [
  {
    name: "PayPay（残高払い）",
    universal: true,
    url: "https://paypay.ne.jp/event/paypaystep/",
    rate: "0.5%（PayPayステップ達成で1.0%）",
    method: "PayPay残高でのコード決済",
    note: "前月に「200円以上の決済を月30回」かつ「支払い合計10万円以上」の両方を満たすと、翌月+0.5%。2026年6月2日以降、PayPayポイントで支払った分はステップ付与の対象外（回数・金額のカウントには引き続き含まれる）。公共料金や金券など一部対象外の支払いあり。［確認日: 2026-08-09／出典: PayPay公式ヘルプ・PayPayステップ公式］"
  },
  {
    name: "PayPay（PayPayクレジット／PayPayカード）",
    universal: true,
    url: "https://www.paypay-card.co.jp/service/benefit/point/",
    rate: "1.0%（ステップ達成で1.5%）",
    method: "PayPayクレジット、またはPayPayカードでの決済",
    note: "残高払いより還元率が高い。2026年6月2日にPayPayカード特典がPayPayステップへ統合されたため、PayPayカードをPayPayアプリに登録していないとポイントが付かない点に注意。【2026年8月末で変更】PayPayカード以外の他社クレカを直接ひも付ける方式は8月末で終了し、以降は「他社カード利用券」を事前購入する方式になる（三井住友カード発行の個人カードは例外的に従来方式のまま。ただしPayPayステップの対象外）。［確認日: 2026-08-09／出典: PayPay公式・報道各社］"
  },
  {
    name: "PayPayカード ゴールド",
    universal: true,
    url: "https://paypay.ne.jp/card-gold/",
    rate: "1.0%（年100万円利用で年会費相当を回収）",
    method: "PayPayカード ゴールドでの決済、またはPayPayアプリ連携",
    note: "年会費11,000円。2026年6月2日の改定で「+0.5%上乗せ」は廃止され、基本の付与率は年会費無料のPayPayカードと同じ1.0%になった。代わりに年100万円以上の決済で11,000ポイント（年会費相当）が付与される特典が新設。実質的な価値はソフトバンク・ワイモバイル契約者向けの割引と上乗せに寄っているため、キャリアが違う人はメリットが薄い。ソフトバンクの新プラン（ペイトク2など）に変更すると通信料の付与率が10%→1%に下がる点にも注意。［確認日: 2026-08-09／出典: PayPayカード公式・報道各社］"
  },
  {
    name: "V NEOBANKデビット（住信SBI）",
    universal: true,
    url: "https://www.netbk.co.jp/contents/lp/vneobank/",
    rate: "1.5%（2026/11/1から1.25%）",
    method: "V NEOBANKデビット（Mastercard）での決済。月間合計1,000円以上の利用が条件",
    expires: "2026-10-31",
    note: "年会費無料で常時1.5%。ただし1,000円未満の端数は切り捨てで計算されるため、少額決済が多いと実質還元率は下がる。【2026年11月1日から大幅改定】①還元率が1.25%に引き下げ ②他社決済サービスへのチャージ（VポイントPay・ANA Pay・au PAY・Revolut・交通系IC・コード決済など）が軒並みポイント対象外に ③鉄道・公共料金・税金・病院なども対象外に ④円普通預金の月50pt特典が廃止 ⑤他行からの被振込ポイントが20pt→10ptに半減。チャージルートの起点として使っていた場合、11月以降はその用途では還元されなくなる点に注意。［確認日: 2026-08-09／出典: 公式発表・報道各社］"
  },
  {
    name: "デビットカード Point＋（住信SBI）",
    universal: true,
    url: "https://www.netbk.co.jp/contents/lp/debit/pointplus/",
    rate: "1.25〜2.0%（スマプロランクで変動）",
    method: "デビットカード Point＋（Mastercard）での決済",
    note: "年会費無料。基本1.25%に、スマプロランクに応じて最大+0.75%が上乗せされる。ランクは円普通預金＋SBIハイブリッド預金の残高、または残高以外の条件で決まり、判定月末のランクが翌々月から適用される。給与・年金の受け取り設定で1.5%になる。V NEOBANKデビットが2026年11月に改定されるため、その移行先として比較検討する価値がある。［確認日: 2026-08-09／出典: 住信SBIネット銀行公式・比較メディア複数］"
  },
  {
    name: "カテエネBANKデビット",
    universal: true,
    url: "https://katene.chuden.jp/clubkatene/p/lp/katenebank/",
    rate: "1.0〜2.0%（月末残高による）",
    method: "カテエネBANKデビットカードでの決済",
    note: "中部電力ミライズ×住信SBIネット銀行の専用支店。月末残高200万円以上で2.0%、200万円未満で1.0%。中部電力の契約不要で誰でも口座開設可能。カテエネポイントはVポイント・楽天・dポイント・Pontaへ等価交換可能。2026年11月のV NEOBANK改悪後の最有力代替。200万円を用意できない場合は第一生命NEOBANKデビット Premium（条件なし1.5%）が現実的。［確認日: 2026-08-12／出典: カテエネBANK公式・各種情報サイト複数］"
  },
  {
    name: "第一生命NEOBANKデビット Premium",
    universal: true,
    url: "https://www.netbk.co.jp/",
    rate: "1.5%",
    method: "第一生命NEOBANKデビット Premium（Mastercard）での決済。月間合計1,000円以上の利用が条件",
    note: "2026年3月24日のリニューアルで還元率1.5%になった、住信SBIネット銀行グループのデビットカード（第一生命支店）。年会費無料でリアルカードも発行できる点がV NEOBANKデビットとの違い。貯まったポイントは500ポイント以上から現金化もできる。【弱点】鉄道・チャージ・公共料金・税金・病院などは対象外取引で還元率が0.3%に下がるため、他ルートの起点（チャージ用）には向かない。V NEOBANKデビットが2026年11月に改定・弱体化するため、その代替の一つとして選ばれることが増えている。［確認日: 2026-08-11／出典: 住信SBIネット銀行公式・比較メディア複数］"
  },
  {
    name: "楽天カード",
    universal: true,
    url: "https://www.rakuten-card.co.jp/",
    rate: "1.0%",
    method: "楽天カードでのクレジット決済（タッチ決済・差し込みどちらでも）",
    note: "どこで使っても1.0%の安定した還元。楽天ポイントカードが使えない店や、コード決済に対応していないレジでは、これが確実な選択肢になる。楽天ポイントカード提示に対応した店なら、楽天ペイとの併用（二重取り）の方が有利になりやすい。［確認日: 2026-08-09／出典: 楽天カード公式・比較メディア複数］"
  },
  {
    name: "楽天ペイ（ポイントカード提示との併用）",
    universal: true,
    url: "https://pointcard.rakuten.co.jp/",
    rate: "合計 最大2.5%（このお店は加盟店です）",
    method: "会計前に楽天ペイアプリ内の楽天ポイントカードを提示し、そのうえで楽天ペイで支払う",
    note: "このお店は楽天ポイントカードの加盟店なので、提示と支払いの二重取りができます。会計前に楽天ペイアプリ内の楽天ポイントカードを提示し、そのうえで楽天ペイで支払ってください。【注意】プラスチックのポイントカード提示は対象外で、必ずアプリ内のカードを提示する必要があります。楽天ペイ側を1.5%にするには、カウント期間中に規定回数以上の提示が必要で、条件を満たせないと1.0%止まりです。［確認日: 2026-08-09］"
  },
  {
    name: "楽天ペイ",
    universal: true,
    url: "https://pay.rakuten.co.jp/",
    rate: "1.0〜1.5%（加盟店では最大2.5%）",
    method: "楽天ペイアプリでのコード決済（チャージ元は楽天カード／楽天キャッシュなど）",
    note: "加盟店でポイントカードを提示すれば二重取りで最大2.5%になりますが、提示に対応していない店では1.0〜1.5%です。2026年3月に制度変更があり情報が錯綜しているため、利用前に楽天ペイ公式で現在の条件を確認するのが安全。郵便局やOKストアなど対象外店舗もあります。［確認日: 2026-08-09］"
  },
  {
    name: "d払い",
    universal: true,
    url: "https://service.smt.docomo.ne.jp/keitai_payment/",
    rate: "0.5%（街のお店）／1.0%（ネット）",
    method: "d払いアプリでのコード決済",
    note: "支払い方法をdカードに設定すると還元率が上がる。ドコモのランク制度により最大4.0%まで上がる仕組みもある。［確認日: 2026-08-09／出典: 比較メディア複数］"
  },
  {
    name: "auPAY",
    universal: true,
    url: "https://aupay.wallet.auone.jp/",
    rate: "0.5%",
    method: "auPAYアプリでのコード決済",
    note: "「auマネ活プラン」加入で最大1.5〜2.0%まで上がる。トモズ・Vドラッグ・ノジマ・オリジン・エディオンなどでは0.5〜1%が上乗せされる。［確認日: 2026-08-09／出典: 各決済アプリ公式サイト］"
  },
  {
    name: "FamiPay",
    universal: true,
    url: "https://www.family.co.jp/famipay.html",
    rate: "0.5%",
    method: "FamiPayアプリでのコード決済",
    note: "［確認日: 2026-08-09／出典: 各決済アプリ公式サイト］"
  },
  {
    name: "AEON Pay",
    universal: true,
    url: "https://www.aeon.co.jp/aeonpay/",
    rate: "0.5%",
    method: "AEON Payでのスマホ決済",
    note: "イオン系列では毎月20日・30日のお客さま感謝デーで5%OFFの対象決済にもなる。［確認日: 2026-08-09／出典: イオン公式］"
  },
  {
    name: "リクルートカード",
    universal: true,
    url: "https://recruit-card.jp/",
    rate: "1.2%",
    method: "リクルートカードでのクレジット決済（どこでも一律）",
    note: "特約店を気にせず、どこで使っても1.2%。年会費無料カードでは最高水準の基本還元率で、公共料金や携帯料金の支払いでも1.2%が付きます（多くのカードは公共料金だと還元率が下がります）。貯まるリクルートポイントはPontaポイント・dポイントへ1:1で交換可能。［確認日: 2026-08-09］"
  }
];

// ---------- 期間限定キャンペーンの期限判定 ----------
// カードに expires: "2026-08-31" があれば期間限定、無ければ常設として扱う。
// 「終了済みかどうか」を毎回その場で計算するので、9月になれば自動的に
// 終了済み扱いになり、古い情報を出し続ける事故を防げる。
function daysUntil(dateStr){
  if(!dateStr) return null;
  const end = new Date(dateStr + "T23:59:59");
  if(isNaN(end)) return null;
  const now = new Date();
  return Math.floor((end - now) / (1000 * 60 * 60 * 24));
}

function campaignStatus(card){
  const d = daysUntil(card.expires);
  if(d === null) return { kind: "permanent" };            // 常設
  if(d < 0)      return { kind: "expired", days: d };     // 終了済み
  if(d <= 7)     return { kind: "ending", days: d };      // まもなく終了
  return { kind: "active", days: d };                      // 期間限定（開催中）
}

function expiryBadgeHtml(card){
  const st = campaignStatus(card);
  if(st.kind === "permanent") return "";
  if(st.kind === "expired")   return `<span class="expiry-badge expired">終了（${escapeHtml(card.expires)}）</span>`;
  if(st.kind === "ending")    return `<span class="expiry-badge ending">あと${st.days}日</span>`;
  return `<span class="expiry-badge active">〜${escapeHtml(card.expires.slice(5).replace("-", "/"))}</span>`;
}

// 終了済みキャンペーンを隠すかどうか（既定は隠す）
let hideExpired = true;
// 各店舗の比較に、全店共通のスマホ決済を混ぜて表示するか
let showUniversal = true;

function visibleCards(store){
  return store.cards.filter(c => !(hideExpired && campaignStatus(c).kind === "expired"));
}

const DEFAULT_STORES = [
  {
    "name": "NewDays",
    "category": "コンビニ",
    "cards": [
      {
        "name": "ビックカメラSuicaカード",
        "rate": "1.0%＋JRE POINT優待",
        "method": "Suica払い、またはカード決済",
        "note": "JR東日本の駅ナカ店舗はJRE POINT優待店のため、通常還元に上乗せされる場合がある。［確認日: 2026-08-09］",
        "url": "https://www.jreast.co.jp/card/"
      }
    ]
  },
  {
    "name": "セイコーマート",
    "category": "コンビニ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "セブン-イレブン",
    "category": "コンビニ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "最大10〜11%",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "ベースは7%（Oliveクレジットモードは8%）。これにセブン-イレブンアプリの会員コード提示などの条件達成で+3%が上乗せされ、Oliveクレジットモードなら最大11%、その他の三井住友カードなら最大10%。上乗せ3%のうち0.5%はセブンマイルとして付与（Vポイントに交換可）。1万円超は対象外になることがある。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "articleUrl": "articles/smbc-seven-eleven-max-11percent.html",
        "url": "https://www.smbc-card.com/camp/seven-eleven_vpoint/index.html"
      },
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "オンラインショッピング・デリバリー・セブン自販機・スマホレジは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1.5%（3倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。一部対象外の店舗あり。法人会員は対象外。 JCB基本0.5%に対して3倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "セブンカード・プラス",
        "rate": "最大10%",
        "method": "セブンカード・プラスでのクレジット決済（事前に7iDへのカード登録が必要）",
        "note": "内訳はnanacoポイント9.5%＋セブンマイル0.5%。7iDへの登録をしていないと大幅に還元率が下がる。一部対象外の支払い方法・商品・サービスあり（収納代行、たばこ、金券類など）。［確認日: 2026-08-09］",
        "url": "https://www.7card.co.jp/"
      },
      {
        "name": "セゾンゴールドプレミアム",
        "rate": "2.5〜5%（年間利用額で変動）",
        "method": "セゾンゴールドプレミアムでの決済",
        "note": "年間利用額で還元率が変わる方式：30万円以上で5%、15万円以上で4%、15万円未満は2.5%。判定は毎月行われ、家族カードの利用分も合算される。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      },
      {
        "name": "セゾンパール・アメックス",
        "rate": "2%",
        "method": "QUICPay払い",
        "note": "QUICPayでの支払いに限り2%還元。カードを直接使った通常決済では還元率が下がるので、必ずQUICPayを選ぶこと。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      },
      {
        "name": "JCB CARD W",
        "rate": "2%",
        "method": "JCB CARD Wでの決済（事前のポイントアップ登録が必要）",
        "note": "JCBオリジナルシリーズの中でも常時2倍の区分。18〜39歳限定で申し込め、39歳までに入会すれば40歳以降も年会費無料。J-POINTパートナーではさらに上乗せされる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "最大10〜11%",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/camp/seven-eleven_vpoint/index.html"
      },
      {
        "name": "JCBゴールド",
        "rate": "1.5%（3倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ファミリーマート",
    "category": "コンビニ",
    "cards": [
      {
        "name": "セゾンパール・アメックス",
        "rate": "2%",
        "method": "QUICPay払い",
        "note": "QUICPayでの支払いに限り2%還元。カードを直接使った通常決済では還元率が下がるので、必ずQUICPayを選ぶこと。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      }
    ]
  },
  {
    "name": "ポプラ",
    "category": "コンビニ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。ポプラグループが対象。 JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ミニストップ",
    "category": "コンビニ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "ローソン",
    "category": "コンビニ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "ナチュラルローソン・ローソンストア100も対象。駅ビル内やガソリンスタンド併設店、オンライン・デリバリー・スマホレジは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      },
      {
        "name": "セゾンゴールドプレミアム",
        "rate": "2.5〜5%（年間利用額で変動）",
        "method": "セゾンゴールドプレミアムでの決済",
        "note": "年間利用額で還元率が変わる方式：30万円以上で5%、15万円以上で4%、15万円未満は2.5%。判定は毎月行われ、家族カードの利用分も合算される。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      },
      {
        "name": "セゾンパール・アメックス",
        "rate": "2%",
        "method": "QUICPay払い",
        "note": "QUICPayでの支払いに限り2%還元。カードを直接使った通常決済では還元率が下がるので、必ずQUICPayを選ぶこと。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      },
      {
        "name": "ローソンPontaプラス",
        "rate": "最大6%",
        "method": "ローソンPontaプラスでの決済",
        "note": "時間帯や利用額の条件で還元率が変動する。詳細な適用条件は公式ページで確認を推奨。［確認日: 2026-08-09］",
        "url": "https://www.lawson.co.jp/ponta/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "ケンタッキーフライドチキン",
    "category": "ファストフード",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。モバイルオーダーは2025年9月16日から対象に追加。1回1万円超は対象外になることがある。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "ゼッテリア",
    "category": "ファストフード",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "店頭決済および公式アプリのモバイルオーダーでのクレジット決済が対象。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "ドミノ・ピザ",
    "category": "ファストフード",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ピザハットオンライン",
    "category": "ファストフード",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "ピザハット公式サイト・公式アプリでのオンライン注文時のクレジットカード決済",
        "note": "店頭での決済は対象外（オンライン注文限定）。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "フレッシュネスバーガー",
    "category": "ファストフード",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "マクドナルド",
    "category": "ファストフード",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。モバイルオーダーは2025年9月16日から対象に追加。1回1万円超は対象外になることがある。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "dカード（d払い経由）",
        "rate": "基本1%、キャンペーン時のみ7%前後",
        "method": "d払い（dカードを支払い設定）",
        "note": "常設の優待ではなく、不定期キャンペーン時のみ還元率が上がる方式。キャンペーンをやっていない時期は基本の1%還元にとどまる点に注意。［確認日: 2026-08-09／出典: dポイントクラブ公式・比較メディア複数］",
        "url": "https://dcard.docomo.ne.jp/st/dpoint_tokuyaku/index.html"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "モバイルオーダー／マックデリバリー限定（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。モバイルオーダー・マックデリバリー限定。店頭での通常決済は対象外。 JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "セゾンゴールドプレミアム",
        "rate": "2.5〜5%（年間利用額で変動）",
        "method": "セゾンゴールドプレミアムでの決済",
        "note": "年間利用額で還元率が変わる方式：30万円以上で5%、15万円以上で4%、15万円未満は2.5%。判定は毎月行われ、家族カードの利用分も合算される。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "モバイルオーダー／マックデリバリー限定（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "モスバーガー",
    "category": "ファストフード",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。モバイルオーダーは2025年9月16日から対象に追加。1回1万円超は対象外になることがある。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "ロッテリア",
    "category": "ファストフード",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "ゼッテリアと同系列。店頭決済および公式アプリのモバイルオーダーが対象。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要。複合商業施設内・駅ビル内・ガソリンスタンド併設の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "すき家",
    "category": "牛丼・定食",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。モバイルオーダーは2025年9月16日から対象に追加。1回1万円超は対象外になることがある。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCB CARD W",
        "rate": "10.5%",
        "method": "事前にJ-POINTパートナーでポイントアップ登録のうえ、JCBカードで支払う",
        "method2": null,
        "note": "2026年4月半ばからJCBの特約店に追加。JCBオリジナルシリーズで10%、常時+0.5%が付くJCB CARD Wなら10.5%。エントリーは一度すれば以降は不要。牛丼チェーンで常時10.5%は現状もっとも高い水準。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "Vクーポン（三井住友カード）",
        "rate": "+10%",
        "method": "事前にVクーポンを獲得したうえで、対象店舗で三井住友カード決済",
        "note": "期間中の上限は公式ページで要確認。事前にVpassアプリまたはVクーポンサイトでクーポンを獲得しておく必要がある（獲得し忘れると対象外）。Vポイントアプリのクーポンも併せてセットしておけば、提示分と決済分で重ね取りができる。［確認日: 2026-08-09／出典: 三井住友カード公式・報道各社］",
        "expires": "2026-08-31",
        "url": "https://www.smbc-card.com/camp/vcoupon/index.jsp"
      }
    ],
    "acceptNote": "使えるもの：クレカ（タッチ決済含む）、電子マネー（iD・QUICPay・楽天Edy・交通系IC）、QR決済（PayPay・楽天ペイ・d払い・au PAY・メルペイなど）、ポイントカード（d・V・楽天・Ponta）。※nanaco・WAONは原則使えません（イオンモール内店舗は例外あり）。"
  },
  {
    "name": "吉野家",
    "category": "牛丼・定食",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。モバイルオーダーは2025年9月16日から対象に追加。1回1万円超は対象外になることがある。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済 または モバイルオーダー（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ],
    "acceptNote": "使えるもの：クレカ（2024年12月から全店でタッチ決済対応）、電子マネー（交通系IC・iD・QUICPay・楽天Edy・nanaco・WAON）、QR決済（PayPay・楽天ペイ・d払い・au PAYなど）。幅広く対応しています。"
  },
  {
    "name": "松のや／マイカリー食堂",
    "category": "牛丼・定食",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "松屋フーズ系列。店舗券売機・セルフレジのほか、松弁ネット・モバイルオーダー・松弁デリバリーも対象。松屋公式オンラインショップと高速SA・PA内店舗は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要。複合商業施設内・駅ビル内・ガソリンスタンド併設の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "松屋",
    "category": "牛丼・定食",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "松のや・マイカリー食堂も対象。店舗券売機・セルフレジでの決済のほか、松弁ネット・松屋モバイルオーダー・松弁デリバリーも対象（ステーキ屋松・松軒中華食堂・すし松なども含む）。松屋公式オンラインショップと高速SA・PA内店舗は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "夢庵",
    "category": "牛丼・定食",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "ガスト（すかいらーくグループ）",
    "category": "ファミレス",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "Vクーポン（三井住友カード）",
        "rate": "+5%",
        "method": "事前にVクーポンを獲得したうえで、対象店舗で三井住友カード決済",
        "note": "期間中500ポイントまで。事前にVpassアプリまたはVクーポンサイトでクーポンを獲得しておく必要がある（獲得し忘れると対象外）。Vポイントアプリのクーポンも併せてセットしておけば、提示分と決済分で重ね取りができる。［確認日: 2026-08-09／出典: 三井住友カード公式・報道各社］",
        "expires": "2026-08-31",
        "url": "https://www.smbc-card.com/camp/vcoupon/index.jsp"
      }
    ]
  },
  {
    "name": "ココス",
    "category": "ファミレス",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "サイゼリヤ",
    "category": "ファミレス",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ],
    "excludes": [
      "qr",
      "emoney"
    ],
    "acceptNote": "使えるもの：クレジットカード（タッチ決済含む・Visa/MC/JCB/AMEX/Diners）、交通系IC（Suica・ICOCAなど）、現金。※商業施設内の店舗では例外的にWAONやiDが使えることがあります。"
  },
  {
    "name": "しゃぶ葉",
    "category": "ファミレス",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "Vクーポン（三井住友カード）",
        "rate": "+5%",
        "method": "事前にVクーポンを獲得したうえで、対象店舗で三井住友カード決済",
        "note": "期間中500ポイントまで。事前にVpassアプリまたはVクーポンサイトでクーポンを獲得しておく必要がある（獲得し忘れると対象外）。Vポイントアプリのクーポンも併せてセットしておけば、提示分と決済分で重ね取りができる。［確認日: 2026-08-09／出典: 三井住友カード公式・報道各社］",
        "expires": "2026-08-31",
        "url": "https://www.smbc-card.com/camp/vcoupon/index.jsp"
      }
    ]
  },
  {
    "name": "ジョナサン",
    "category": "ファミレス",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "デニーズ",
    "category": "ファミレス",
    "cards": [
      {
        "name": "セブンカード・プラス",
        "rate": "1%",
        "method": "セブンカード・プラスでのクレジット決済",
        "note": "セブン&アイグループ店舗は通常0.5%から1%にアップ。イトーヨーカドーは毎月8のつく日（8日・18日・28日）に5%オフの特典もある。［確認日: 2026-08-09］",
        "url": "https://www.7card.co.jp/"
      }
    ]
  },
  {
    "name": "バーミヤン",
    "category": "ファミレス",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "Vクーポン（三井住友カード）",
        "rate": "+5%",
        "method": "事前にVクーポンを獲得したうえで、対象店舗で三井住友カード決済",
        "note": "期間中500ポイントまで。事前にVpassアプリまたはVクーポンサイトでクーポンを獲得しておく必要がある（獲得し忘れると対象外）。Vポイントアプリのクーポンも併せてセットしておけば、提示分と決済分で重ね取りができる。［確認日: 2026-08-09／出典: 三井住友カード公式・報道各社］",
        "expires": "2026-08-31",
        "url": "https://www.smbc-card.com/camp/vcoupon/index.jsp"
      }
    ]
  },
  {
    "name": "かっぱ寿司",
    "category": "回転寿司",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "dPOINT（来店回数キャンペーン）",
        "rate": "最大10倍（来店5回で）",
        "method": "dポイント提示",
        "note": "来店1回で2倍、2回5倍、3回6倍、4回7倍、5回10倍と段階的にアップ。来店回数のカウントは1日最大1回まで、対象は5回まで。進呈上限は1,000ポイント（期間・用途限定）。要エントリーで、会計時にdポイントカードの提示が必要。株主優待での支払い分はポイント対象外。［確認日: 2026-08-09／出典: かっぱ寿司公式・カッパクリエイト発表］",
        "expires": "2026-08-31",
        "url": "https://www.kappasushi.jp/campaign_list/"
      }
    ],
    "acceptNote": "使えるもの：店内会計はクレカ・QR決済（PayPay・d払い・楽天ペイ・au PAY・メルペイ・AEON Pay）・電子マネー（流通系／交通系とも）。※お持ち帰りWEB予約ではQR決済・電子マネーが使えず、クレジットカード・dポイント・株主優待のみです。"
  },
  {
    "name": "くら寿司",
    "category": "回転寿司",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "スマホでお持ち帰り・どこでもくら寿司・通販などのオンライン事前決済は対象外。ららぽーとTOKYO-BAY店など一部店舗は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ],
    "excludes": [
      "emoney",
      "transit"
    ],
    "acceptNote": "使えるもの：クレジットカード（Visa/MC/JCB/AMEX/Diners/Discover・タッチ決済含む）、QRコード決済（PayPay・楽天ペイ・d払い・au PAYなど）、現金。※Suica・ICOCAなどの交通系ICを含む、すべての電子マネーが使えません。テイクアウトのオンライン決済はVisa/MastercardとQR決済のみ。"
  },
  {
    "name": "スシロー",
    "category": "回転寿司",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "オンライン決済、京樽スシロー、スシローToGoでの利用は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      },
      {
        "name": "auPAY",
        "rate": "10%（持ち帰りネット注文限定）",
        "method": "au PAY支払い",
        "note": "持ち帰りネット注文5000円以上、1回550ポイント・期間中2回まで。7/22〜8/16の期間限定キャンペーン。［確認日: 2026-08-09／出典: 各決済アプリ公式サイト］",
        "expires": "2026-08-16",
        "url": "https://camp.auone.jp/campaign/0df4b414dd4f1ae8d3eb8384"
      }
    ]
  },
  {
    "name": "はま寿司",
    "category": "回転寿司",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "丸亀製麺",
    "category": "飲食店",
    "cards": [
      {
        "name": "各種スマホ決済",
        "rate": "決済アプリの基本還元率",
        "method": "PayPay・楽天ペイ・d払い・au PAYなどのコード決済、交通系IC、クレカ",
        "note": "特約店としての上乗せは確認できていないため、全店共通の決済のなかから選ぶのが基本。［確認日: 2026-08-09］",
        "url": null
      }
    ]
  },
  {
    "name": "UCC Cafe Plaza",
    "category": "カフェ",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "上島珈琲店と同系列。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要。複合商業施設内・駅ビル内・ガソリンスタンド併設の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "エクセルシオール カフェ",
    "category": "カフェ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "カフェ・ド・クリエ",
    "category": "カフェ",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "モバイルオーダーとクリエカードへのチャージは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      },
      {
        "name": "セゾンゴールドプレミアム",
        "rate": "2.5〜5%（年間利用額で変動）",
        "method": "セゾンゴールドプレミアムでの決済",
        "note": "年間利用額で還元率が変わる方式：30万円以上で5%、15万円以上で4%、15万円未満は2.5%。判定は毎月行われ、家族カードの利用分も合算される。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      }
    ]
  },
  {
    "name": "カフェ・ベローチェ",
    "category": "カフェ",
    "cards": [
      {
        "name": "セゾンゴールドプレミアム",
        "rate": "2.5〜5%（年間利用額で変動）",
        "method": "セゾンゴールドプレミアムでの決済",
        "note": "年間利用額で還元率が変わる方式：30万円以上で5%、15万円以上で4%、15万円未満は2.5%。判定は毎月行われ、家族カードの利用分も合算される。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      }
    ]
  },
  {
    "name": "コメダ珈琲店",
    "category": "カフェ",
    "cards": [
      {
        "name": "各種決済",
        "rate": "決済アプリの基本還元率",
        "method": "クレカ、交通系IC、コード決済（店舗により異なる）",
        "note": "フランチャイズ店が多く、店舗ごとに使える決済が異なる。KOMECA（プリペイド）へのチャージでポイントが付く場合がある。［確認日: 2026-08-09］",
        "url": null
      }
    ]
  },
  {
    "name": "サンマルクカフェ",
    "category": "カフェ",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "スターバックス",
    "category": "カフェ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "モバイルオーダー限定（スターバックスアプリまたはApp Clip経由のApple Pay決済のみ）",
        "note": "店頭でのタッチ決済は対象外。スターバックスカードへのチャージも対象外なので注意。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "dカード",
        "rate": "4%（カードチャージ）／7%（Starbucks eGift購入）",
        "method": "スターバックスカードへのオンライン入金・オートチャージ、またはStarbucks eGiftの購入",
        "note": "レジでdカードを直接出して支払っても特約店ポイントは付かない。基本1%＋特約店ポイント3%（eGiftは6%）の合計。dカード GOLDも同率。［確認日: 2026-08-09／出典: dカード公式・比較メディア複数］",
        "url": "https://dcard.docomo.ne.jp/st/dpoint_tokuyaku/index.html"
      },
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "スターバックスカードへのオンライン入金のみ",
        "note": "店頭での入金・利用は対象外。Apple Payでのチャージも対象外。三井住友カードとは対象取引が正反対（あちらはモバイルオーダー限定でチャージ対象外）なので使い分けに注意。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "モバイルオーダー／カードへのオンライン入金・オートチャージ／Starbucks eGift（事前登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。モバイルオーダー、スターバックスカードへのオンライン入金・オートチャージ、Starbucks eGiftが対象。店舗での直接利用・店頭入金は対象外。 JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "セゾンゴールドプレミアム",
        "rate": "2.5〜5%（年間利用額で変動）",
        "method": "セゾンゴールドプレミアムでの決済",
        "note": "年間利用額で還元率が変わる方式：30万円以上で5%、15万円以上で4%、15万円未満は2.5%。判定は毎月行われ、家族カードの利用分も合算される。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "モバイルオーダー限定（スターバックスアプリまたはApp Clip経由のApple Pay決済のみ）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "モバイルオーダー／カードへのオンライン入金・オートチャージ／Starbucks eGift（事前登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "スターバックス（店頭）",
    "category": "カフェ",
    "cards": [
      {
        "name": "各種決済",
        "rate": "決済手段による",
        "method": "スターバックスカード、クレカ、交通系IC、PayPayなど",
        "note": "三井住友カードの7%はモバイルオーダー限定、三菱UFJはオンラインチャージ限定など、カードによって対象取引が異なる。詳しくは「スターバックス」の項目を参照。［確認日: 2026-08-09］",
        "url": null
      }
    ]
  },
  {
    "name": "ドトールコーヒー",
    "category": "カフェ",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "Oliveフレキシブルペイのクレジットモードは8%、デビットモードは1.5%。1回1万円を超えると差し込み扱いになり対象外になることがある。商業施設内の店舗は対象外の場合あり。［確認日: 2026-08-09／出典: 三井住友カード公式「対象のコンビニ・飲食店で最大8％還元！」］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      },
      {
        "name": "dカード",
        "rate": "4%（ドトールバリューカードのチャージ限定）",
        "method": "ドトールバリューカードへのクレジットチャージ",
        "note": "基本1%＋特約店ポイント3%の合計。dカードでの直接決済では特約店ポイントは付かず、必ずバリューカード経由のチャージが必要。［確認日: 2026-08-09／出典: 比較メディア複数］",
        "url": "https://dcard.docomo.ne.jp/st/dpoint_tokuyaku/index.html"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "7%（Oliveクレジットモードは8%）",
        "method": "スマホのタッチ決済のみ（カード現物のタッチ・iD・差し込み・磁気は対象外）",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/cardinfo/23/cardinfo9001629.jsp"
      }
    ]
  },
  {
    "name": "上島珈琲店",
    "category": "カフェ",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "UCC Cafe Plazaも対象。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "珈琲館",
    "category": "カフェ",
    "cards": [
      {
        "name": "セゾンゴールドプレミアム",
        "rate": "2.5〜5%（年間利用額で変動）",
        "method": "セゾンゴールドプレミアムでの決済",
        "note": "年間利用額で還元率が変わる方式：30万円以上で5%、15万円以上で4%、15万円未満は2.5%。判定は毎月行われ、家族カードの利用分も合算される。［確認日: 2026-08-09］",
        "url": "https://www.saisoncard.co.jp/"
      }
    ]
  },
  {
    "name": "アオキスーパー",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "ショッピングセンターアズパーク内の専門店・花いちばアズガーデン、クイックコマース・インターネット注文は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "イオン",
    "category": "スーパー",
    "cards": [
      {
        "name": "イオンカード",
        "rate": "5%OFF（毎月20日・30日限定、割引方式）",
        "method": "イオンマークのカード払い／AEON Payのスマホ決済／電子マネーWAON",
        "note": "還元ポイントではなく「会計から5%OFF」という割引形式。イオン・イオンスタイル・マックスバリュ・ザ・ビッグなど幅広く対象だが、たばこ・切手・商品券・酒類の一部などは対象外。毎月10日の「ありが10デー」はポイント5倍（還元率2.5%相当）で別方式。［確認日: 2026-08-09／出典: イオンカード公式・WAON公式］",
        "url": "https://www.aeon.co.jp/merit/thanks_day/"
      }
    ]
  },
  {
    "name": "イトーヨーカドー",
    "category": "スーパー",
    "cards": [
      {
        "name": "セブンカード・プラス",
        "rate": "1%",
        "method": "セブンカード・プラスでのクレジット決済",
        "note": "セブン&アイグループ店舗は通常0.5%から1%にアップ。イトーヨーカドーは毎月8のつく日（8日・18日・28日）に5%オフの特典もある。［確認日: 2026-08-09］",
        "url": "https://www.7card.co.jp/"
      }
    ]
  },
  {
    "name": "オーケー",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "ネットスーパーは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "オオゼキ",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "オンラインストア・ネットスーパーは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "サンリブ",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "マルショク・リブホール・サンク・サンリブBUONO各店も対象。ネットスーパーは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "ジャパンミート",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "MEATMeet・パワーマートも対象。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "スーパー魚長",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "生鮮乃木市場・生鮮げんき市場も対象。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "ドミー",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "一部対象外の店舗あり。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "ハーベス",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "近商ストア系列。ネットスーパーと食品スーパー以外の利用は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要。複合商業施設内・駅ビル内・ガソリンスタンド併設の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "フィール",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "テナント・インターネットでの利用は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "フードストアあおき",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "ネットスーパーは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "ヤマナカ",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "フランテ・フランテロゼも対象。ネットスーパーは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "やまや",
    "category": "スーパー",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ヨークマート",
    "category": "スーパー",
    "cards": [
      {
        "name": "セブンカード・プラス",
        "rate": "1%",
        "method": "セブンカード・プラスでのクレジット決済",
        "note": "セブン&アイグループ店舗は通常0.5%から1%にアップ。イトーヨーカドーは毎月8のつく日（8日・18日・28日）に5%オフの特典もある。［確認日: 2026-08-09］",
        "url": "https://www.7card.co.jp/"
      }
    ]
  },
  {
    "name": "近商ストア",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "ハーベス各店・Pochetteも対象。ネットスーパーと食品スーパー以外の利用は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "三和・フードワン",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "成城石井",
    "category": "スーパー",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。成城石井.com（オンラインショップ）とLe Bar a Vin 52 AZABU TOKYOも対象。 JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "東急ストア",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "プレッセ・フードステーションも対象。テナントとネットスーパーは対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "東武ストア",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "ネットショップ・手ぶら決済・専門店売り場は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "肉のハナマサ",
    "category": "スーパー",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "フランチャイズ店は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "北海市場",
    "category": "スーパー",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "コカ・コーラ自販機",
    "category": "自販機",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "自販機上のタッチ決済（カードのタッチ決済／QUICPay）またはCoke ON Pay・Coke ON Pass",
        "note": "Coke ONアプリに対象カードを登録しての決済も対象だが、Apple Pay利用分は対象外。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "ジハンピ",
    "category": "自販機",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "Hulu",
    "category": "エンタメ",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。最大5倍。プレミアムカード（ゴールド以上）でよりおトクになる区分。 JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "U-NEXT",
    "category": "エンタメ",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。最大5倍。プレミアムカード（ゴールド以上）でよりおトクになる区分。 JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "コミックシーモア",
    "category": "エンタメ",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。最大5倍。プレミアムカード（ゴールド以上）でよりおトクになる区分。 JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ディズニープラス",
    "category": "エンタメ",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ナガシマリゾート",
    "category": "エンタメ",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ユニバーサル・スタジオ・ジャパン",
    "category": "エンタメ",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。最大20倍。プレミアムカード（ゴールド以上）でよりおトクになる区分。 JCB基本0.5%に対して20倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "10%（20倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "Vトリップ（宿泊予約サイト）",
    "category": "トラベル",
    "cards": [
      {
        "name": "三井住友カード / Olive",
        "rate": "最大+18.5%（2026/8/31まで還元率UP中）",
        "method": "Vトリップ経由での宿泊予約・決済",
        "note": "通常特典の最大+8.5%に、期間限定のキャンペーン上乗せ分を加えた数値。三井住友カード経由の宿泊予約サイトを通した予約が対象で、ホテルに直接申し込む場合は対象外。期間や上乗せ幅は変動しやすいので、予約前に公式サイトで最新の還元率を確認するのが安全。［確認日: 2026-08-09／出典: 三井住友カード公式 リワードアップ一覧］",
        "expires": "2026-08-31",
        "url": "https://www.smbc-card.com/mem/platinum-preferred/special-store/index.jsp"
      },
      {
        "name": "三井住友カード ゴールド（NL）",
        "rate": "最大+18.5%（2026/8/31まで還元率UP中）",
        "method": "Vトリップ経由での宿泊予約・決済",
        "note": "対象店での還元率は通常の三井住友カード（NL）と同じ。ゴールドの差は、年間100万円利用で10,000ポイント付与＋翌年以降の年会費永年無料、空港ラウンジ、保険といった別枠の特典にある。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/mem/platinum-preferred/special-store/index.jsp",
        "expires": "2026-08-31"
      }
    ]
  },
  {
    "name": "コジマ",
    "category": "ホームセンター",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ジョーシン",
    "category": "ホームセンター",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ソフマップ",
    "category": "ホームセンター",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ダイシン",
    "category": "ホームセンター",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1.5%（3倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して3倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1.5%（3倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ビックカメラ／ビックドラッグ",
    "category": "ホームセンター",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "ビックカメラSuicaカード",
        "rate": "最大11.5%",
        "method": "Suicaにチャージしてから、ビックカメラでSuica払い",
        "note": "チャージ時のJRE POINT 1.5%＋ビックカメラでのSuica払い10%の合計。カードで直接支払うと10%還元にはならないので、必ずSuicaを経由すること。一般加盟店では1.0%（ビックポイント0.5%＋JRE POINT 0.5%）。［確認日: 2026-08-09］",
        "url": "https://www.jreast.co.jp/card/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "AOKI",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "OWNDAYS／オンデーズ",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1.5%（3倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して3倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1.5%（3倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "アレックス",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（登録不要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。この店舗はポイントアップ登録が不要。 JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（登録不要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "コナカグループ",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "はるやまチェーン",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "メガネサロンルック・ルックコンタクト",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "メガネのプリンス",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "好日山荘",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "洋服の青山",
    "category": "ファッション",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して5倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "2.5%（5倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "Amazon",
    "category": "ネット通販",
    "cards": [
      {
        "name": "クレジットカードの還元",
        "rate": "カード次第",
        "method": "手持ちの高還元カードで決済",
        "note": "他社と比べポイント制度が弱く、ポイントサイトの対象カテゴリも限られる。カード側の還元率で選ぶ方が実利が大きい。［確認日: 2026-08-09］",
        "url": "https://www.amazon.co.jp/"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "3倍（1.5%）",
        "method": "Amazon.co.jp での支払いにJCBオリジナルシリーズを使う（事前登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。通常ポイント1倍＋ポイントアップ登録で+2倍＝合計3倍。JCB CARD W なら常時+1倍が加算されるためさらに有利で、Amazonは実質2%相当になる。事前にJ-POINTパートナーサイトでポイントアップ登録が必要（無料・初回1度きり）。登録を忘れると倍率アップの対象外になる。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "App Store / Apple",
    "category": "ネット通販",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "倍率は時期により変動",
        "method": "App Store・iTunes での支払いにJCBオリジナルシリーズを使う（事前登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。J-POINTパートナーの「オンラインサービス」区分。2026年1月のJ-POINTリリースでオンラインサービスが対象に加わった。倍率はキャンペーン時期で変わるため、購入前にJ-POINTパートナーサイトで現在の倍率を確認すること。事前にJ-POINTパートナーサイトでポイントアップ登録が必要（無料・初回1度きり）。登録を忘れると倍率アップの対象外になる。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "Google Play",
    "category": "ネット通販",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "J-POINT最大5倍＋Google Play Points最大8%",
        "method": "Google Play での課金・サブスク支払いにJCBオリジナルシリーズを使う",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。【2つの特典が別枠で走る】①Google Play Points の還元（5,000円以上の利用で最大4,000ポイント＝最大8%）は事前登録不要で自動エントリー。②J-POINTの倍率アップは事前のポイントアップ登録が必要。この2つを混同してエントリーを忘れないこと。ゴールド以上（JCBザ・クラス／プラチナ／ゴールド）は10倍になる時期もある。JCB CARD W / W plus L は常時+1倍が別途加算。キャンペーン期間は入れ替わるので最新情報を確認。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://www.jcb.co.jp/campaign/gp2607/index.html"
      }
    ]
  },
  {
    "name": "Qoo10",
    "category": "ネット通販",
    "cards": [
      {
        "name": "ポイントサイト経由",
        "rate": "平常時 1〜2%（メガ割時は大きく上昇）",
        "method": "ポイントサイト経由でQoo10へ移動してから購入（アプリ経由は対象外のことが多い）",
        "note": "【変動が大きい案件】平常時は1〜2%程度だが、メガ割期間にはポイントサイト側も連動して上がり、過去には16〜20%に達した例もある。買う時期をメガ割に合わせるだけで効果が大きいため、急がない買い物は待つ方が有利。サイト間の差も大きいので、購入直前に複数サイトを見比べること。アプリからの購入はポイント対象外になりやすい点に注意。［確認日: 2026-08-09］",
        "url": "https://pc.moppy.jp/"
      }
    ]
  },
  {
    "name": "SHEIN",
    "category": "ネット通販",
    "cards": [
      {
        "name": "ポイントサイト経由",
        "rate": "案件により変動",
        "method": "ポイントサイト経由でSHEINへ移動してから購入",
        "note": "【変動が大きい案件】還元率はサイトごと・時期ごとの差が大きい。購入直前に複数サイトを確認すること。［確認日: 2026-08-09］",
        "url": "https://pc.moppy.jp/"
      }
    ]
  },
  {
    "name": "Yahoo!ショッピング",
    "category": "ネット通販",
    "cards": [
      {
        "name": "ポイントサイト経由（モッピー等）",
        "rate": "1.0%前後",
        "method": "ポイントサイト経由でアクセスしてから購入",
        "note": "案件により変動あり。［確認日: 2026-08-09］",
        "url": "https://pc.moppy.jp/"
      },
      {
        "name": "PayPay支払い＋5のつく日",
        "rate": "イベント時に大きく上振れ",
        "method": "PayPayで支払い、5のつく日やLYPプレミアム特典と重ねる",
        "note": "PayPayポイントが基軸。大型イベント時の還元が大きいので、急がない買い物はイベントを待つ方が有利になりやすい。［確認日: 2026-08-09］",
        "url": "https://shopping.yahoo.co.jp/"
      }
    ]
  },
  {
    "name": "ふるさと納税（さとふる等）",
    "category": "ネット通販",
    "cards": [
      {
        "name": "ポイントサイト経由",
        "rate": "案件により変動",
        "method": "ポイントサイト経由で各ふるさと納税サイトへ移動してから寄付",
        "note": "寄付額が大きいため、還元率がわずかでも金額の効果が大きい。年末は還元率が上がりやすい傾向。［確認日: 2026-08-09］",
        "url": "https://pc.moppy.jp/"
      }
    ]
  },
  {
    "name": "ユニクロ オンラインストア",
    "category": "ネット通販",
    "cards": [
      {
        "name": "ポイントサイト経由",
        "rate": "案件により変動",
        "method": "ポイントサイト経由でユニクロ公式オンラインストアへ移動してから購入",
        "note": "店舗受け取りを選ぶと対象外になる場合がある。購入前に条件を確認すること。［確認日: 2026-08-09］",
        "url": "https://pc.moppy.jp/"
      }
    ]
  },
  {
    "name": "楽天市場",
    "category": "ネット通販",
    "cards": [
      {
        "name": "ポイントサイト経由（モッピー等）",
        "rate": "1.0%",
        "method": "ポイントサイトのボタンから楽天市場へ移動し、24時間以内に決済する",
        "note": "モッピー／ハピタス／ワラウ／ちょびリッチ／ポイントタウンの主要5サイトすべて1.0%で横並び（2026年7月時点）。どこ経由でも率は同じなので、大事なのは「経由し忘れないこと」。モッピーは買い回り時に一括決済でも全ショップ分に付く。モッピーのゴールド会員なら獲得ポイントの15%が上乗せ。楽天リーベイツ経由は0.2%と低いため楽天市場では非推奨。［確認日: 2026-08-09］",
        "url": "https://pc.moppy.jp/"
      },
      {
        "name": "5と0のつく日（楽天カード）",
        "rate": "+1%",
        "method": "毎月5・10・15・20・25・30日に、要エントリーのうえ楽天カードで決済",
        "note": "エントリーは毎回必要（1回で終わりではない）。ポイント付与に上限があるため、高額購入時は事前に確認を。［確認日: 2026-08-09］",
        "url": "https://event.rakuten.co.jp/campaign/point-up/5-0/"
      },
      {
        "name": "SPU（楽天カード・銀行・証券など）",
        "rate": "条件次第で上乗せ",
        "method": "楽天の各サービスの利用条件を満たす",
        "note": "条件を積み上げるほど倍率が上がるが、改定が頻繁にあるため現在の条件は公式で確認を。［確認日: 2026-08-09］",
        "url": "https://event.rakuten.co.jp/campaign/point-up/spu/"
      }
    ]
  },
  {
    "name": "JR（在来線・新幹線）",
    "category": "交通",
    "cards": [
      {
        "name": "J-WESTカード（モバイルICOCA）",
        "rate": "1.5%（ゴールドは3.0%）",
        "method": "モバイルICOCAにJ-WESTカードからチャージして乗車",
        "note": "JRはクレカ乗車の対象外なので、交通系ICへのチャージで還元を取ります。【重要】SMART ICOCAでのチャージは対象外（0.5%）。必ずモバイル版を使い、WESTER ID連携も済ませること。［確認日: 2026-08-09］",
        "url": "https://wester.jr-odekake.net/j-west/point/"
      },
      {
        "name": "ビューカード（モバイルSuica）",
        "rate": "1.5%（定期券は5.0%）",
        "method": "モバイルSuicaへのチャージ・オートチャージ、または定期券購入",
        "note": "ビューカード直系である必要があります。イオンSuicaカードなどは対象外で0.5%。SuicaはICOCAエリアでもそのまま使えます。［確認日: 2026-08-09］",
        "url": "https://www.jreast.co.jp/card/"
      },
      {
        "name": "Wesmo!（JR西日本のスマホ決済）",
        "rate": "基本0.5%",
        "method": "Wesmo!アプリでの決済",
        "note": "キャンペーン時に還元率が上がることがあります（過去に4%還元の実績あり）。［確認日: 2026-08-09］",
        "url": "https://wester.jr-odekake.net/"
      }
    ],
    "acceptNote": "JRはクレジットカードのタッチ決済乗車に対応していません（一部の実証実験区間を除く）。交通系ICへのチャージで還元を取るのが基本です。"
  },
  {
    "name": "バス（路線バス・高速バス）",
    "category": "交通",
    "cards": [
      {
        "name": "JCB CARD W / W plus L",
        "rate": "10.5%",
        "method": "事前にJ-POINTパートナーで登録し、JCBカードまたはJCB設定のスマホを改札にかざす（カード現物でも可）",
        "note": "JCBのクレカ乗車10%に、W会員の常時+0.5%が加算されて10.5%。2027年5月15日までの1年間、全国約190事業者が対象。【必須】事前のポイントアップ登録を忘れると倍率が上がりません。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%",
        "method": "事前登録のうえ、JCBカードまたはJCB設定のスマホを改札にかざす",
        "note": "通常の20倍。カード現物のタッチ決済でも対象になるのが三井住友との違い。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード / Olive",
        "rate": "最大8%",
        "method": "Apple Pay / Google Payに登録したスマホをかざす（カード現物のタッチは対象外）",
        "note": "2026年4月13日からの常設特典。必ずスマホをかざすこと。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/"
      },
      {
        "name": "交通系IC（ICOCA・Suicaなど）",
        "rate": "チャージ時のカード還元",
        "method": "交通系ICで運賃を支払う",
        "note": "バス自体の還元はないため、チャージ段階でどれだけ還元されるかで決まります。［確認日: 2026-08-09］",
        "url": null
      }
    ],
    "acceptNote": "クレカのタッチ決済に対応するバス事業者が増えています。JCBは全国約190事業者が対象で、バス・フェリー・ロープウェイも含みます。"
  },
  {
    "name": "私鉄・地下鉄（近鉄・阪急・阪神・南海・Osaka Metro など）",
    "category": "交通",
    "cards": [
      {
        "name": "JCB CARD W / W plus L",
        "rate": "10.5%",
        "method": "事前にJ-POINTパートナーで登録し、JCBカードまたはJCB設定のスマホを改札にかざす（カード現物でも可）",
        "note": "JCBのクレカ乗車10%に、W会員の常時+0.5%が加算されて10.5%。2027年5月15日までの1年間、全国約190事業者が対象。【必須】事前のポイントアップ登録を忘れると倍率が上がりません。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "10%",
        "method": "事前登録のうえ、JCBカードまたはJCB設定のスマホを改札にかざす",
        "note": "通常の20倍。カード現物のタッチ決済でも対象になるのが三井住友との違い。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "三井住友カード / Olive",
        "rate": "最大8%",
        "method": "Apple Pay / Google Payに登録したスマホをかざす（カード現物のタッチは対象外）",
        "note": "2026年4月13日からの常設特典。必ずスマホをかざすこと。［確認日: 2026-08-09］",
        "url": "https://www.smbc-card.com/"
      },
      {
        "name": "その他のタッチ決済対応カード",
        "rate": "カードの基本還元率",
        "method": "Visa / JCB / American Express / Diners のタッチ決済対応カードをかざす",
        "note": "事前登録なしで、きっぷを買わずに乗車できます。大人普通運賃のみで、割引運賃や定期券には使えません。［確認日: 2026-08-09］",
        "url": null
      },
      {
        "name": "PiTaPa",
        "rate": "区間・利用額に応じた割引",
        "method": "ポストペイ（後払い）方式のため事前チャージ不要",
        "note": "ポイント還元ではなく「運賃そのものの割引」なので、還元率での比較には向きません。定期代わりに使う場合や、区間指定割引が効く通勤区間では有利になることがあります。まずは上のクレカ乗車を検討し、そのうえで自分の利用区間に割引があるか確認するのが順番として妥当です。［確認日: 2026-08-09］",
        "url": "https://www.osaka-pitapa.com/"
      }
    ],
    "acceptNote": "対応事業者：Osaka Metro全駅、近鉄全駅（柏原駅・生駒鋼索線を除く）、阪急全駅、阪神全駅（西代駅を除く）、南海、大阪モノレール、神戸市営地下鉄、神戸電鉄、泉北高速鉄道など。"
  },
  {
    "name": "J-POINT（JCBのポイント制度）",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "基本0.5%（1ポイント=1円）",
        "method": "JCBオリジナルシリーズでの決済全般",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。【2026年1月にOki Dokiポイントから移行】旧ポイントは5倍に換算して自動移行済み。1ポイント=1円で使える分かりやすい仕組みになった。1回の利用が200円未満でも月合計で換算されるので、少額決済でも取りこぼしがない。■ポイントの貯まり方は3階建て：①通常ポイント（全ての決済）②J-POINTパートナー（登録した対象店で最大10%）③J-POINTボーナス（年間50万円達成ごとに翌月ボーナス）。■【最重要】ポイントアップ登録を忘れると倍率が上がらない。J-POINTパートナーサイトで店舗ごとに事前登録が必要（無料・多くは初回1度きりで以降は不要）。■【2026年からの変更点】従来は「MyJチェック登録+1倍」＋「ポイントアップ登録+1倍」で3倍だったが、2026年以降は「ポイントアップ登録+2倍」だけで3倍になる方式に変わった。MyJチェック登録は倍率に関係しなくなっている。■海外加盟店の優遇も2026年からポイントアップ登録が必要になった（海外ダブルポイントサービスは2026年1月12日で終了）。■JCB CARD W / W plus L / Biz ONE は常時+1倍が別途加算されるため、同じ店でも他のオリジナルシリーズより1段高くなる。［確認日: 2026-08-09／出典: JCB公式］",
        "url": "https://www.jcb.co.jp/promotion/j-point/"
      }
    ]
  },
  {
    "name": "アカチャンホンポ",
    "category": "その他",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "クレジットカード決済／カード現物のタッチ決済／Apple Pay（QUICPay）が対象。スマホのタッチ決済とグローバルポイントWalletは対象外",
        "note": "アカチャンホンポ Online Shopも対象。店頭ではMastercard・JCB・Visaのみ優遇対象で、QUICPay利用分は対象外。 7%の内訳は基本0.5%＋スペシャルポイント6.5%。スペシャルポイント対象は月5万円まで。最大20%にするには、支払口座を三菱UFJ銀行に設定してMDCアプリからエントリーが必要（アプリログイン・楽Pay登録・給与受取などの条件を積み上げる方式）。複合商業施設内の店舗は対象外の場合あり。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "ウエルシア",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。ハックドラッグ・金光薬品も対象。 JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ウェルパーク",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "カーブス",
    "category": "その他",
    "cards": [
      {
        "name": "三菱UFJカード",
        "rate": "7%（条件達成で最大20%）",
        "method": "入会金・月会費のカード払い",
        "note": "都度の利用ではなく、入会金と月会費の支払いが対象。【ブランド注意】一部店舗ではアメリカン・エキスプレスが優遇対象外のため、対象店をもれなくカバーするならVisa/Mastercard/JCBを選ぶこと。［確認日: 2026-08-09／出典: 三菱UFJニコス公式「対象店舗のご利用分が最大20％還元」］",
        "url": "https://www.cr.mufg.jp/apply/card/mucard/pup/index03.html"
      }
    ]
  },
  {
    "name": "コクミン",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "スーパードラッグひまわり",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "そごう",
    "category": "その他",
    "cards": [
      {
        "name": "セブンカード・プラス",
        "rate": "1%",
        "method": "セブンカード・プラスでのクレジット決済",
        "note": "セブン&アイグループ店舗は通常0.5%から1%にアップ。イトーヨーカドーは毎月8のつく日（8日・18日・28日）に5%オフの特典もある。［確認日: 2026-08-09］",
        "url": "https://www.7card.co.jp/"
      }
    ]
  },
  {
    "name": "ダックス",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ドラッグストア（ウエルシア等）",
    "category": "その他",
    "cards": [
      {
        "name": "各種決済",
        "rate": "チェーンによる",
        "method": "各チェーンのポイントカード＋決済",
        "note": "ウエルシアは毎月20日の「ウエル活」（Vポイント1.5倍で使える）が有名。詳しくは「ウエルシア」の項目を参照。［確認日: 2026-08-09］",
        "url": null
      }
    ]
  },
  {
    "name": "ハッピー・ドラッグ",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "ふく薬品",
    "category": "その他",
    "cards": [
      {
        "name": "JCBオリジナルシリーズ",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "【事前登録が必須】J-POINTパートナーサイトでこの店舗のポイントアップ登録をしないと倍率は上がりません（無料・初回1度きり、以降は不要）。JCB基本0.5%に対して2倍。JCBカードW / W plus Lなら常時+1倍されるため実質はもう一段高くなる。優待を受けるには事前に公式サイトで店舗ごとのポイントアップ登録が必要（初回1度きりの店舗が大多数）。［確認日: 2026-08-09／出典: JCB公式 J-POINTパートナー］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      },
      {
        "name": "JCBゴールド",
        "rate": "1%（2倍）",
        "method": "対象カードでの決済（事前のポイントアップ登録が必要）",
        "note": "J-POINTパートナーの倍率はJCBオリジナルシリーズ共通。ゴールドの差は、空港ラウンジ、最高1億円の海外旅行傷害保険、ショッピングガード保険、クラブオフ（最大90%OFFの優待）など。USJやU-NEXTなど一部の優待店は「プレミアムカードでおトク」区分でゴールド以上が有利になる。［確認日: 2026-08-09］",
        "url": "https://j-pointpartner.jcb.co.jp/"
      }
    ]
  },
  {
    "name": "マツモトキヨシ／ココカラファイン",
    "category": "その他",
    "cards": [
      {
        "name": "dカード",
        "rate": "合計4%（dポイントカード提示分を含む）",
        "method": "dカードでの決済＋dポイントカード提示",
        "note": "内訳は基本1%＋特約店ポイント3%（dポイントカード提示分を含む合計値）。決済だけでなくポイントカードの提示も忘れずに。［確認日: 2026-08-09／出典: dカード公式・比較メディア複数］",
        "url": "https://dcard.docomo.ne.jp/st/dpoint_tokuyaku/index.html"
      }
    ]
  },
  {
    "name": "リンベル",
    "category": "その他",
    "cards": [
      {
        "name": "dカード",
        "rate": "2%",
        "method": "リンベル オンラインショップでのdカード決済",
        "note": "基本1%＋特約店ポイント1%。オンラインショップでの注文が対象。［確認日: 2026-08-09／出典: dカード公式・比較メディア複数］",
        "url": "https://dcard.docomo.ne.jp/st/dpoint_tokuyaku/index.html"
      }
    ]
  },
  {
    "name": "西武百貨店",
    "category": "その他",
    "cards": [
      {
        "name": "セブンカード・プラス",
        "rate": "1%",
        "method": "セブンカード・プラスでのクレジット決済",
        "note": "セブン&アイグループ店舗は通常0.5%から1%にアップ。イトーヨーカドーは毎月8のつく日（8日・18日・28日）に5%オフの特典もある。［確認日: 2026-08-09］",
        "url": "https://www.7card.co.jp/"
      }
    ]
  },
  {
    "name": "髙島屋",
    "category": "その他",
    "cards": [
      {
        "name": "dカード",
        "rate": "最大2.5%",
        "method": "dカードでのクレジット決済（iD払いは対象外）",
        "note": "髙島屋各店（日本橋・新宿・玉川・横浜・大宮・柏・高崎・大阪・泉北・京都・岡山・JU米子）とタカシマヤフードメゾンおおたかの森、タカシマヤ ウオッチメゾン、エキ・タカ泉ケ丘が対象。髙島屋オンラインストア・通信販売・アウトレット各店はdポイントカードのポイント対象外。一部対象外商品あり。［確認日: 2026-08-09／出典: dカード公式・比較メディア複数］",
        "url": "https://dcard.docomo.ne.jp/std/topics/takashimaya/takashimaya16.html"
      }
    ]
  }
];

// ---------- データの読み込み ----------
// 優先順位：① GitHub上のstores.json（公開データ）→ ②この端末のlocalStorage
// キャッシュ → ③ コード埋め込みのDEFAULT_STORES（オフライン・初回表示用の
// 最終フォールバック）。
const STORAGE_KEY = "kangenchou_stores_v1";
const GITHUB_CONFIG_KEY = "kangenchou_github_config_v1";
const STORES_JSON_PATH = "stores.json"; // 同じフォルダに置く想定

// カード名→記事URLの対応表。
// カード単体の記事はカード選び画面などで使う。
const CARD_ARTICLE_MAP = {
  "三井住友カード / Olive": "articles/smbc-seven-eleven-max-11percent.html",
  "楽天カード": "articles/rakuten-card-review.html",
};

// 店舗ごとの記事URL。
// 同じカードが複数店舗に登録されている場合でも、
// 関係のない店舗の記事が表示されないよう、店舗名も条件にする。
const STORE_CARD_ARTICLE_MAP = {
  "セブン-イレブン": {
    "三井住友カード / Olive": "articles/smbc-seven-eleven-max-11percent.html",
    "三井住友カード ゴールド（NL）": "articles/smbc-seven-eleven-max-11percent.html",
  },
};

// 店舗データにarticleUrlを自動補完する。
// 「三井住友カード / Olive」はセイコーマートにも存在するが、
// セブン-イレブン専用の記事なので、店舗単位で明示的に紐付ける。
function injectArticleUrls(stores){
  return (stores || []).map(store => ({
    ...store,
    cards: (store.cards || []).map(card => {
      const articleUrl = (STORE_CARD_ARTICLE_MAP[store.name] || {})[card.name];
      if(articleUrl && !card.articleUrl) return { ...card, articleUrl };
      // 既存データに誤った店舗横断リンクが残っている場合も除去する。
      if(card.articleUrl && !articleUrl) {
        const knownStoreArticle = Object.values(STORE_CARD_ARTICLE_MAP).some(m =>
          Object.values(m).includes(card.articleUrl)
        );
        if(knownStoreArticle) {
          const { articleUrl: _removed, ...rest } = card;
          return rest;
        }
      }
      return card;
    })
  }));
}

function loadStoresFromCache(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return injectArticleUrls(parsed);
    }
  } catch(e){
    console.warn("店舗データの読み込みに失敗、初期データを使用します", e);
  }
  return injectArticleUrls(JSON.parse(JSON.stringify(DEFAULT_STORES))); // deep copy
}

function saveStoresToCache(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STORES));
  } catch(e){
    console.warn("店舗データの保存に失敗しました", e);
  }
}

function loadGithubConfig(){
  try{
    const raw = localStorage.getItem(GITHUB_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGithubConfig(cfg){
  localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(cfg));
}

let STORES = loadStoresFromCache();

// ---------- チャージルートの読み込み（店舗データと同じ3段階の優先順位） ----------
const ROUTES_STORAGE_KEY = "kangenchou_routes_v1";
const ROUTES_JSON_PATH = "routes.json"; // 同じフォルダに置く想定

function loadRoutesFromCache(){
  try{
    const raw = localStorage.getItem(ROUTES_STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed;
    }
  } catch(e){
    console.warn("チャージルートの読み込みに失敗、初期データを使用します", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_ROUTES)); // deep copy
}

function saveRoutesToCache(){
  try{
    localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(CHARGE_ROUTES));
  } catch(e){
    console.warn("チャージルートの保存に失敗しました", e);
  }
}

let CHARGE_ROUTES = loadRoutesFromCache();
let editMode = false;
let syncPending = false; // 直近の保存がGitHubへのpushに失敗し、再送待ちかどうか
let routesSyncPending = false; // ルートデータ版

function setSyncStatus(text, kind){
  const el = document.getElementById("syncStatus");
  if(!el) return;
  el.textContent = text;
  el.className = "sync-status" + (kind ? " " + kind : "");
}

// 起動時：GitHub上の公開データを取得できたら、それを正としてキャッシュを更新
// 公開されている紹介リンク設定を読み込む。訪問者全員に同じリンクを出すため、
// 端末ごとのlocalStorageより、GitHub上のファイルを優先する。
async function refreshAffiliatesFromGithubPages(){
  try{
    const res = await fetch(`${AFFILIATES_JSON_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if(!res.ok) return; // まだファイルが無い場合は静かに無視
    const data = await res.json();
    if(data && typeof data === "object" && !Array.isArray(data)){
      affiliates = data;
      resolveAffiliateAliases(affiliates);
      saveAffiliates();
      renderStores(); renderInvest(); renderRoutes(); renderFeaturedCards();
    }
  } catch(e){
    console.info("affiliates.json の取得をスキップしました", e.message);
  }
}

async function refreshFromGithubPages(){
  try{
    const res = await fetch(`${STORES_JSON_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if(!res.ok) return; // stores.jsonがまだ存在しない場合は静かに無視
    const data = await res.json();
    if(!Array.isArray(data)) return;
    if(syncPending){
      // 未送信のローカル編集がある間は、リモートで上書きしない
      return;
    }
    STORES = injectArticleUrls(data);
    saveStoresToCache();
    renderStores();
  } catch(e){
    // オフライン時やfile://表示時は取得できないのが正常なので、静かに無視
    console.info("stores.json の取得をスキップしました", e.message);
  }
}

async function refreshRoutesFromGithubPages(){
  try{
    const res = await fetch(`${ROUTES_JSON_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if(!res.ok) return; // routes.jsonがまだ存在しない場合は静かに無視
    const data = await res.json();
    if(!Array.isArray(data)) return;
    if(routesSyncPending){
      // 未送信のローカル編集がある間は、リモートで上書きしない
      return;
    }
    CHARGE_ROUTES = data;
    saveRoutesToCache();
    refreshWalletOptions();
    renderRoutes();
  } catch(e){
    console.info("routes.json の取得をスキップしました", e.message);
  }
}

let storeState = { search: "", category: "コンビニ", sortByRate: false };

// 表示用に、その店舗のカード一覧＋（設定がONなら）全店共通のスマホ決済を合流させる。
// 同名の決済がすでに店舗側にある場合（例：スシローのauPAY限定キャンペーン）は、
// 店舗側の情報のほうが具体的なので、そちらを優先して共通側は落とす。
// 還元率の文字列から並べ替え用の数値を取り出す。
// 「最大10〜11%」「7%（条件達成で最大20%）」「20倍」など表記が揺れるため、
// parseFloat では先頭に文字があると読めない。文字列中の最初の数値を拾い、
// 「N倍」表記はJCB基本0.5%を掛けて実質の％に換算して比較する。
// 三菱UFJカードは条件しだいで還元率が変わるので、シミュレーターの結果を反映する
// 楽天ペイの還元率は、前月のポイントカード提示回数で1.0%か1.5%かが決まる。
// 人によって変わるので、三菱UFJと同じく自分で設定できるようにする。
const RPAY_KEY = "kangenchou_rpay";
let rpayHigh = (()=>{ try{ return localStorage.getItem(RPAY_KEY) === "1"; } catch { return false; } })();

function setRpay(v){
  rpayHigh = v;
  try{ localStorage.setItem(RPAY_KEY, v ? "1" : "0"); } catch {}
  renderStores();
  renderRoutes();
}

// 楽天ペイの「提示との併用」チェックが立っていれば、経由ルート内の楽天ペイ決済分にも反映する
function effectiveSplitRate(s){
  if(s.pt === "楽天ポイント" && /楽天ペイ/.test(s.note || "") && s.rate === 1){
    return rpayHigh ? 1.5 : 1;
  }
  return s.rate;
}

// 楽天ペイの表示を、設定に応じて書き換える
function rpayRate(base){
  if(!/楽天ペイ/.test(base.name)) return base.rate;
  // 提示との併用（加盟店）＝ 提示分1.0% ＋ 楽天ペイ側（1.0 または 1.5）
  if(/提示との併用/.test(base.name)){
    return rpayHigh ? "合計 2.5%（提示1.0%＋支払い1.5%）" : "合計 2.0%（提示1.0%＋支払い1.0%）";
  }
  if(/1\.0〜1\.5%/.test(base.rate)){
    return rpayHigh ? "1.5%（提示条件を達成済み）" : "1.0%（提示条件が未達成）";
  }
  return base.rate;
}

function displayRate(card){
  const rp = rpayRate(card);
  if(rp !== card.rate) return rp;
  if(/三菱UFJ/.test(card.name) && /7%（条件達成で最大20%）/.test(card.rate)){
    const r = mufgRate();
    return r > 7 ? `${r.toFixed(1)}%（あなたの条件）` : "7%（条件達成で最大20%）";
  }
  return card.rate;
}

function rateValue(card){
  const s = String((/三菱UFJ/.test(card.name) ? displayRate(card) : card.rate) || "");
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if(!m) return 0;
  let v = parseFloat(m[1]);
  // ％表記があればその数値をそのまま使う。％が一切なく「N倍」だけの場合のみ換算する。
  if(!/%/.test(s) && /倍/.test(s)) v = v * 0.5;
  return v;
}

// 店ごとに「使えない決済」を持たせ、比較から自動的に外す。
// 使えない決済を勧めるのは、還元率が間違っているより実害が大きいため。
// excludes: その店で使えない決済の種別
//   "qr"    … PayPay・楽天ペイなどのコード決済
//   "emoney"… iD・QUICPay・楽天Edy・nanaco・WAONなど（流通系）
//   "transit"… Suica・ICOCA・PASMOなどの交通系IC
//   サイゼリヤのようにQRはダメだが交通系ICは使える店があるため、種別を分けている。
// accepts: 明示的に使えるものがある場合に補足として表示
function isExcluded(store, cardName){
  const ex = store.excludes || [];
  if(!ex.length) return false;
  const QR = /PayPay|楽天ペイ|d払い|auPAY|au PAY|FamiPay|ファミペイ|AEON Pay|メルペイ|VポイントPay/;
  // 交通系ICも電子マネーの一種。チャージルートは終着点がSuica/ICOCAなら同様に使えない。
  const EM = /iD|QUICPay|楽天Edy|nanaco|WAON/;
  const TR = /Suica|ICOCA|PASMO|交通系/;
  if(ex.includes("qr") && QR.test(cardName)) return true;
  if(ex.includes("emoney") && EM.test(cardName)) return true;
  if(ex.includes("transit") && TR.test(cardName)) return true;
  return false;
}

// 起点カードを指定していない（＝基準）ときでも、楽天ペイの提示条件チェックなど
// split側の調整は反映したいので、静的なatStore.rateにそのまま頼らず算出する。
function routeCurrentRate(route){
  const w = routeWithStarter(route);
  if(w.total != null) return `${w.total.toFixed(1)}%`;
  if(route.split && route.split.length){
    const sum = route.split.reduce((a, s) => a + effectiveSplitRate(s), 0);
    return `${sum.toFixed(1)}%`;
  }
  return route.atStore ? route.atStore.rate : "";
}

function combinedCards(store){
  const own = visibleCards(store);
  let all = own;
  // ネット通販と交通は「お店」ではないため、全店共通の決済やチャージルートを
  // 混ぜない。改札で楽天ペイは使えないし、ECサイトでポイントカード提示もできない。
  const noUni = store.category === "ネット通販" || store.category === "交通";
  // 交通では、改札で使えないコード決済は出さないが、
  // 交通系ICへのチャージルート（ICOCA・Suica系）は実際に使えるので出す。
  if(store.category === "交通" && showUniversal){
    const transitRoutes = CHARGE_ROUTES
      .filter(r => (r.pays || []).some(p => /ICOCA|Suica|交通系/.test(p)))
      .filter(r => routeWithStarter(r).usable)
      .map(r => {
        const w = routeWithStarter(r);
        return { name: r.name,
          rate: routeCurrentRate(r),
          method: r.atStore ? r.atStore.method : "チャージして交通系ICとして利用",
          note: r.note, url: r.url, universal: true, isRoute: true, shutdownWarn: r.shutdownWarn || null };
      });
    all = own.concat(transitRoutes);
  }
  if(showUniversal && !noUni){
    const ownNames = own.map(c => c.name);
    const extras = UNIVERSAL_PAYMENTS.filter(u => {
      if(ownNames.some(n => n.includes(u.name.split("（")[0]))) return false;
      // 提示との併用は楽天ポイントカード加盟店でのみ成立する
      if(/ポイントカード提示/.test(u.name) && !store.rakutenPoint) return false;
      return true;
    });
    all = own.concat(extras);

    // チャージルートの終着点は店頭で使える決済手段なので、比較対象に加える。
    // 「楽天ペイ単体で1%」と「経由すれば2.5%」を並べて見比べられるようにする。
    const routeEntries = CHARGE_ROUTES
      .filter(r => r.atStore)
      // onlyAt があるルートは、その店でだけ出す（例：WAONルートはイオン系のみ）
      .filter(r => !r.onlyAt || r.onlyAt.some(n => store.name.includes(n)))
      // 起点カードを選んでいるなら、そのカードで組めるルートだけ出す
      .filter(r => routeWithStarter(r).usable)
      .map(r => {
        // 起点カードでの実際の還元率に置き換える
        return {
        name: r.name,
        rate: routeCurrentRate(r),
        method: r.atStore.method,
        note: r.note,
        url: r.url,
        universal: true,
        isRoute: true,
        shutdownWarn: r.shutdownWarn || null
      };
      });
    all = all.concat(routeEntries);
  }
  // その店で使えない決済は除外する（使えないものを勧めない）
  all = all.filter(c => !isExcluded(store, c.name));

  // 保有カードが設定されていれば、持っているものだけに絞る。
  // ただし全部消えてしまう店では、比較の手がかりを残すため元の一覧に戻す。
  const mine = all.filter(c => ownsCard(c.name));
  return mine.length ? mine : all;
}

// その店で、持っていないカードのうち最も還元率が高いもの（＝乗り換え候補）
function bestUnowned(store){
  if(!wallet || wallet.size === 0) return null;
  const own = visibleCards(store);
  const others = own.filter(c => !ownsCard(c.name));
  if(!others.length) return null;
  const best = others.reduce((a,b) => rateValue(b) > rateValue(a) ? b : a);
  const mineBest = combinedCards(store).reduce((a,b) => rateValue(b) > rateValue(a) ? b : a, {rate:"0"});
  return rateValue(best) > rateValue(mineBest) ? best : null;
}

function linkHtml(card){
  // 公式リンクと、登録済みならアフィリの申し込みリンクを並べて返す
  return linkRowHtml(card.url, card.name);
}

// 注記に埋め込んだ確認日を読み取り、古くなっていたら警告する。
// 還元率は変動するので「いつ時点の情報か」を常に見せるのが誠実。
// 長い注記を読みやすくする。■で始まる部分を改行して見出し扱いにする。
// JCBのように条件が複雑なカードは、区切りがないと読み飛ばされるため。
function formatNote(text){
  if(!text) return "";
  // note はAI取り込み・手動編集どちらでも入る「信頼できない文字列」なので、
  // HTMLとして組み立てる前に必ずエスケープしてから、見出し用の■だけを改行に変換する。
  return escapeHtml(String(text))
    .replace(/■/g, '<br><span class="note-head">■</span>')
    .replace(/^<br>/, "");
}

// 長い注記は最初の一文だけを表示し、「続きを読む」で展開できるようにする。
// ほとんどの人は読まないという前提で、ホーム画面側は簡潔にしておく。
// 展開後の全文表示や、外部リンク（articleUrl）があれば記事へのリンクも添える。
function noteHtml(text, opts){
  if(!text) return "";
  const cls = (opts && opts.className) || "card-option-note";
  const full = formatNote(text);
  const firstDot = text.indexOf("。");
  const hasShort = firstDot >= 0 && firstDot < text.length - 1;
  const short = hasShort ? text.slice(0, firstDot + 1) : text;

  if(!hasShort){
    // もともと短い注記はそのまま表示（展開の必要なし）
    return `<div class="${cls}">${full}</div>`;
  }

  const articleLink = (opts && opts.articleUrl && isSafeHttpUrl(opts.articleUrl))
    ? `<a href="${escapeAttr(opts.articleUrl)}" class="note-article-link" target="_blank" rel="noopener noreferrer">くわしい記事を読む ↗</a>`
    : "";

  return `
    <div class="${cls} note-collapsible">
      <span class="note-short-text">${escapeHtml(short)}</span>
      <span class="note-full-text" hidden>${full}</span>
      <button type="button" class="note-toggle-btn">続きを読む</button>
      <span class="note-full-extra" hidden>${articleLink}</span>
    </div>
  `;
}

// 注記から確認日・出典を抽出して、カード・ルートの下部に「情報の鮮度」として表示する。
// ASP審査では「情報の根拠が明示されているか」が重要なため、独立したUIとして見せる。
function sourceMetaHtml(text){
  if(!text) return "";
  const dateMatch = text.match(/確認日:\s*(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{4}年\d{1,2}月\d{1,2}日)/);
  const srcMatch  = text.match(/出典:\s*([^］\]]+)/);
  if(!dateMatch && !srcMatch) return "";
  const parts = [];
  if(dateMatch) parts.push(`<span class="source-date">📅 確認日：${escapeHtml(dateMatch[1])}</span>`);
  if(srcMatch)  parts.push(`<span class="source-label">出典：${escapeHtml(srcMatch[1].trim())}</span>`);
  return `<div class="source-meta">${parts.join("")}</div>`;
}

function freshnessHtml(note){
  const m = (note || "").match(/確認日:\s*(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return "";
  const then = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  const days = Math.floor((Date.now() - then) / 86400000);
  if(days < 45) return "";
  const label = days >= 180 ? `${Math.floor(days/30)}か月以上前の情報` : `${days}日前の情報`;
  return `<div class="stale-flag">⏳ ${label}です。変わっている可能性があるため、公式ページで確認してください。</div>`;
}

// noteHtml() で作った「続きを読む」トグルの開閉。
// カード一覧はいろんな箇所で動的に再生成されるため、個別にbindせず document 側で一括処理する。
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".note-toggle-btn");
  if(!btn) return;
  const wrap = btn.closest(".note-collapsible");
  if(!wrap) return;
  const shortEl = wrap.querySelector(".note-short-text");
  const fullEl = wrap.querySelector(".note-full-text");
  const extraEl = wrap.querySelector(".note-full-extra");
  const expanded = wrap.classList.toggle("expanded");
  if(shortEl) shortEl.hidden = expanded;
  if(fullEl) fullEl.hidden = !expanded;
  if(extraEl) extraEl.hidden = !expanded;
  btn.textContent = expanded ? "閉じる" : "続きを読む";
});

// 「お店から探す」リストの合間に挟むPRカード。.store-card と同じ見た目のトーンで作るが、
// クリックできる要素・「PR」ラベル・遷移先が違う（アフィリエイトの詳細記事へ）。
function buildAdCardEl(slot){
  const url = affiliateForKey(slot.affKey);
  if(!url) return null; // 管理画面でリンク未設定なら広告自体を出さない

  const card = document.createElement("div");
  card.className = "store-card store-ad-card";

  const iconSvg = slot.kind === "pointsite"
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`;

  card.innerHTML = `
    <a class="store-ad-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer nofollow sponsored">
      <div class="store-head">
        <div class="store-head-icon store-ad-icon">${iconSvg}</div>
        <div class="store-head-mid">
          <div class="store-name">${escapeHtml(slot.name)}</div>
          <div class="store-sub">${escapeHtml(slot.tagline)}</div>
        </div>
        <div class="store-head-right">
          <div class="store-ad-badge">PR</div>
          <div class="store-rate-label" style="margin-top:6px;">詳しく見る →</div>
        </div>
      </div>
    </a>
  `;
  return card;
}

function buildStoreCardEl(store, distanceMeters){
  const shown = combinedCards(store);
  const sorted = [...shown].sort((a,b) => rateValue(b) - rateValue(a));

  const card = document.createElement("div");
  card.className = "store-card collapsed";
  if(editMode) card.classList.add("edit-mode");

  // ---- カテゴリアイコン（SVGパス） ----
  const CAT_PATHS = {
    "コンビニ": `<path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 21v-6h6v6"/>`,
    "ファストフード": `<path d="M4 10h16"/><path d="M5 10a7 7 0 0 1 14 0"/><path d="M3 14h18"/><path d="M4 14l1 6h14l1-6"/>`,
    "牛丼・定食": `<path d="M4 12a8 4 0 0 0 16 0"/><path d="M4 12V9a8 4 0 0 1 16 0v3"/><path d="M2 12h20"/>`,
    "ファミレス": `<path d="M18 3v18"/><path d="M15 3v6a3 3 0 0 0 6 0V3"/><path d="M6 3v6a3 3 0 0 1-6 0"/><path d="M3 3v18"/>`,
    "回転寿司": `<ellipse cx="12" cy="14" rx="9" ry="4"/><path d="M12 10V4"/><path d="M9 6h6"/>`,
    "飲食店（その他）": `<path d="M18 3v18"/><path d="M15 3v6a3 3 0 0 0 6 0V3"/><path d="M6 3v6a3 3 0 0 1-6 0"/><path d="M3 3v18"/>`,
    "カフェ": `<path d="M3 8h13v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2"/>`,
    "スーパー": `<circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/><path d="M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.6L21 8H6"/>`,
    "自販機": `<rect x="6" y="2" width="12" height="20" rx="1"/><rect x="8" y="5" width="8" height="6"/>`,
    "エンタメ": `<path d="M12 3v18"/><path d="m7 8 5-5 5 5"/><path d="M4 15a8 8 0 0 0 16 0"/>`,
    "トラベル": `<path d="m17.8 19.2 1-1-3.4-2.7-.1-4.1c0-1.4-.6-2.7-1.6-3.7L9.5 3.5a1 1 0 0 0-1.7.7v4.2L3.1 6.9a1 1 0 0 0-1.1.2l-.4.4a1 1 0 0 0 .1 1.5l4.1 3.2H2.4a1 1 0 0 0-.7 1.7l3.5 3.5c1 1 2.3 1.6 3.7 1.6l4.1.1 2.7 3.4 1-1-1-4Z"/>`,
    "ホームセンター": `<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>`,
    "ファッション": `<path d="M20.4 14.5 16 10l4-4-3-3-5 5-5-5-3 3 4 4-4.4 4.5c-.4.4-.4 1 0 1.4l2.6 2.6c.4.4 1 .4 1.4 0L11 15v7h6v-7l3.4 3.5c.4.4 1 .4 1.4 0l2.6-2.6c.4-.4.4-1 0-1.4Z"/>`,
    "ネット通販": `<circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/><path d="M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.6L21 8H6"/>`,
    "交通": `<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><circle cx="8.5" cy="15.5" r="0.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="0.5" fill="currentColor"/>`,
    "ドラッグストア": `<path d="m10.5 20.5 8-8a4.95 4.95 0 1 0-7-7l-8 8a4.95 4.95 0 1 0 7 7Z"/>`,
    "その他": `<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>`,
  };
  const catPath = CAT_PATHS[store.category] || CAT_PATHS["その他"];
  const catIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${catPath}</svg>`;

  const distText = (typeof distanceMeters === "number")
    ? (distanceMeters < 1000 ? Math.round(distanceMeters)+"m" : (distanceMeters/1000).toFixed(1)+"km")
    : null;

  const bestRate = sorted[0] ? sorted[0].rate : "—";
  // 数値だけ取り出して大きめに表示する
  const rateMatch = bestRate.match(/(\d+(?:\.\d+)?)\s*[%％]/);
  const rateNum = rateMatch ? rateMatch[1] : "—";
  const rateUnit = bestRate.includes("OFF") ? "%OFF" : "%";
  const ratePrefix = /最大/.test(bestRate) ? "最大" : "還元率";

  // タグエリア非表示
  const tagsHtml = "";

  const head = document.createElement("div");
  head.className = "store-head";
  head.innerHTML = `
    <div class="store-head-icon">${catIconSvg}</div>
    <div class="store-head-mid">
      <div class="store-name">${escapeHtml(store.name)}${verifyBadgeHtml("store:" + store.name)}</div>
      <div class="store-sub">${escapeHtml(store.category)}${distText ? ` <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg> ${distText}` : ` · ${sorted.length}件のカード`}</div>
    </div>
    <div class="store-head-right">
      <button class="fav-btn${isFav(store.name) ? " on" : ""}" title="よく行く店にする">${isFav(store.name) ? "♥" : "♡"}</button>
      <div class="store-best-wrap">
        <div class="store-rate-label">${ratePrefix}</div>
        <div class="store-best-badge">${rateNum}<span class="rate-unit">${rateUnit}</span></div>
        <div class="store-rate-bottom">ポイント還元</div>
      </div>
    </div>
  `;
  head.addEventListener("click", (e)=>{
    if(e.target.closest(".icon-btn")) return;
    if(e.target.closest(".fav-btn")){ toggleFav(store.name); return; }
    card.classList.toggle("collapsed");
  });

  // タグ行
  const tagsEl = document.createElement("div");
  tagsEl.className = "store-tags";
  tagsEl.innerHTML = tagsHtml;

  // ルートボックス（最もお得な決済方法を1行で表示）
  const routeBox = document.createElement("div");
  routeBox.className = "store-route-box";
  routeBox.innerHTML = `
    <div>
      <div class="store-route-box-label">対応決済（一番お得なカード）</div>
      <div class="store-route-box-val">${escapeHtml(sorted[0] ? sorted[0].method || sorted[0].name : "—")}</div>
    </div>
    <svg class="store-route-box-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
  `;
  routeBox.addEventListener("click", ()=> card.classList.toggle("collapsed"));


  // 編集ボタン（編集モード時のみ表示）
  const editBtns = document.createElement("div");
  editBtns.style.cssText = "display:flex;gap:8px;padding:0 16px 12px;";
  editBtns.innerHTML = `
    <button class="icon-btn edit-store-btn" title="お店情報を編集" style="font-size:11px;padding:4px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--muted);">✎ 編集</button>
    <button class="icon-btn delete-store-btn" title="お店を削除" style="font-size:11px;padding:4px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--muted);">🗑 削除</button>
  `;
  editBtns.querySelector(".edit-store-btn").addEventListener("click", ()=> openStoreModal(store));
  editBtns.querySelector(".delete-store-btn").addEventListener("click", ()=> deleteStore(store));

  const options = document.createElement("div");
  options.className = "card-options";

  // 今日の特典と、開催中のクーポンを1位の上にまとめて出す（見逃し防止）
  const todays = todayDeals().filter(x => x.where &&
    (x.where.includes(store.name) || store.name.includes(x.where.split("・")[0])));
  const live = visibleCards(store).filter(c => c.expires && campaignStatus(c).kind !== "expired");
  if(todays.length || live.length){
    const t = document.createElement("div");
    t.className = "store-today";
    t.innerHTML = [
      ...todays.map(x => `<b>今日は${escapeHtml(x.rate)}</b>　${escapeHtml(x.name)}`),
      ...live.map(x => `<b>クーポン開催中 ${escapeHtml(x.rate)}</b>　${escapeHtml(x.name)}`)
    ].join("<br>");
    options.appendChild(t);
  }

  // 持っていないカードの訴求は、埋もれないよう1位の上に出す（訴求力を優先）
  const up = bestUnowned(store);
  if(up){
    const hint = document.createElement("div");
    hint.className = "upgrade-hint-top";
    const y = yenBack(up);
    const aff = affiliateFor(up.name);
    hint.innerHTML = `
      <div class="upgrade-hint-top-main">持っていない<b>${escapeHtml(up.name)}</b>なら<b>${escapeHtml(up.rate)}</b>${y !== null ? `（${y.toLocaleString()}円分）` : ""}</div>
      ${sorted[0] ? `<div class="upgrade-hint-top-sub">今の1位：${escapeHtml(sorted[0].name)}　${escapeHtml(sorted[0].rate)}</div>` : ""}
      ${(aff && isSafeHttpUrl(aff)) ? `<a class="src-link apply-link" href="${escapeAttr(aff)}" target="_blank" rel="sponsored noopener noreferrer">申し込み ↗</a>` : ""}
    `;
    options.appendChild(hint);
  }

  const LIMIT = 5;
  sorted.forEach((c, i)=>{
    const opt = document.createElement("div");
    opt.className = "card-option" + (i === 0 ? " is-winner" : "") + (c.universal ? " is-universal" : "") + (i >= LIMIT ? " is-extra" : "");
    opt.innerHTML = `
      <div class="card-option-top">
        <span class="card-option-rank ${i===0 ? "rank-1" : ""}">${i+1}位</span>
        <span class="card-option-name">${escapeHtml(c.name)}</span>
        ${c.isRoute ? `<span class="universal-tag route-tag">経由ルート</span>` : (c.universal ? `<span class="universal-tag">全店共通</span>` : "")}
        ${expiryBadgeHtml(c)}
        <span class="card-option-rate">${escapeHtml(displayRate(c))}${(()=>{const y=yenBack(c); return y!==null ? `<span class="rate-yen">${y.toLocaleString()}円</span>` : "";})()}</span>
        <button class="icon-btn edit-card-btn" title="編集">✎</button>
        <button class="icon-btn delete-card-btn" title="削除">🗑</button>
      </div>
      <div class="card-option-method">${escapeHtml(c.method || "")}</div>
      ${(c.image && isSafeHttpUrl(c.image)) ? `<img src="${escapeAttr(c.image)}" alt="${escapeAttr(c.name)}" class="card-option-image" loading="lazy">` : ""}
      ${c.shutdownWarn ? `<div class="route-shutdown-warn" style="margin:4px 0 2px;"><b>⚠️ 終了予定</b>　${escapeHtml(c.shutdownWarn.replace('⚠️ ', '').replace(/^終了予定。/, ''))}</div>` : ""}
      ${/【変動が大きい案件】/.test(c.note || "") ? `<div class="volatile-flag">📈 還元率の変動が大きい案件です。購入直前に必ず現在の値を確認してください。</div>` : ""}
      ${c.note ? noteHtml(c.note) : ""}
      ${(c.articleUrl && isSafeHttpUrl(c.articleUrl)) ? `<a href="${escapeAttr(c.articleUrl)}" class="card-article-btn" target="_blank" rel="noopener noreferrer">📖 くわしい記事を読む ↗</a>` : ""}
      ${freshnessHtml(c.note)}
      ${linkHtml(c)}
    `;
    if(c.universal){
      // 共通決済は店舗データではないので、この場では編集させない
      opt.querySelectorAll(".icon-btn").forEach(b => b.remove());
    } else {
      opt.querySelector(".edit-card-btn").addEventListener("click", ()=> openCardModal(store, c));
      opt.querySelector(".delete-card-btn").addEventListener("click", ()=> deleteCard(store, c));
    }
    options.appendChild(opt);
  });

  // 決済一覧の直後に置く（「使えません」や追加ボタンより前）
  if(sorted.length > LIMIT){
    const more = document.createElement("button");
    more.className = "show-more-btn";
    more.textContent = `ほか${sorted.length - LIMIT}件の決済方法を見る`;
    more.addEventListener("click", ()=>{ card.classList.add("show-all"); more.remove(); });
    options.appendChild(more);
  }

  const addCardRow = document.createElement("div");
  addCardRow.className = "add-card-row";
  addCardRow.innerHTML = `<button class="add-card-btn">＋ このお店にカードを追加</button>`;
  addCardRow.querySelector("button").addEventListener("click", ()=> openCardModal(store, null));
  options.appendChild(addCardRow);

  if(store.excludes && store.excludes.length){
    const labels = [];
    if(store.excludes.includes("qr")) labels.push("PayPay・楽天ペイなどのコード決済");
    if(store.excludes.includes("emoney")) labels.push("iD・QUICPay・楽天Edyなどの電子マネー");
    if(store.excludes.includes("transit")) labels.push("Suica・ICOCAなどの交通系IC");
    const note = document.createElement("div");
    note.className = "cannot-use";
    note.innerHTML = `使えません：${labels.join("／")}${store.acceptNote ? `<br><span class="cannot-use-ok">${escapeHtml(store.acceptNote)}</span>` : ""}`;
    options.appendChild(note);
  }

  card.appendChild(head);
  card.appendChild(tagsEl);
  card.appendChild(routeBox);
  card.appendChild(options);
  if(editMode) card.appendChild(editBtns);
  return card;
}

function storeBestRate(store){
  return store.cards.reduce((max, c) => Math.max(max, rateValue(c)), 0);
}

// カテゴリ → アイコンSVGパス のマッピング
const CATEGORY_CHIP_ICONS = {
  "すべて":           `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>`,
  "コンビニ":         `<path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 21v-6h6v6"/>`,
  "飲食店（すべて）": `<path d="M18 3v18"/><path d="M15 3v6a3 3 0 0 0 6 0V3"/><path d="M6 3v6a3 3 0 0 1-6 0"/><path d="M3 3v18"/>`,
  "ファストフード":   `<path d="M4 10h16"/><path d="M5 10a7 7 0 0 1 14 0"/><path d="M3 14h18"/><path d="M4 14l1 6h14l1-6"/>`,
  "牛丼・定食":       `<path d="M4 12a8 4 0 0 0 16 0"/><path d="M4 12V9a8 4 0 0 1 16 0v3"/><path d="M2 12h20"/>`,
  "ファミレス":       `<path d="M18 3v18"/><path d="M15 3v6a3 3 0 0 0 6 0V3"/><path d="M6 3v6a3 3 0 0 1-6 0"/><path d="M3 3v18"/>`,
  "回転寿司":         `<ellipse cx="12" cy="14" rx="9" ry="4"/><path d="M12 10V4"/><path d="M9 6h6"/>`,
  "飲食店（その他）": `<path d="M18 3v18"/><path d="M15 3v6a3 3 0 0 0 6 0V3"/><path d="M6 3v6a3 3 0 0 1-6 0"/><path d="M3 3v18"/>`,
  "カフェ":           `<path d="M3 8h13v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2"/><path d="M6 2v2M10 2v2M14 2v2"/>`,
  "スーパー":         `<circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/><path d="M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.6L21 8H6"/>`,
  "ドラッグストア":   `<path d="m10.5 20.5 8-8a4.95 4.95 0 1 0-7-7l-8 8a4.95 4.95 0 1 0 7 7Z"/><path d="M8.5 8.5l7 7"/>`,
  "自販機":           `<rect x="6" y="2" width="12" height="20" rx="1"/><rect x="8" y="5" width="8" height="6"/><circle cx="10" cy="15" r="1" fill="currentColor"/><circle cx="14" cy="15" r="1" fill="currentColor"/>`,
  "エンタメ":         `<path d="M12 3v18"/><path d="m7 8 5-5 5 5"/><path d="M4 15a8 8 0 0 0 16 0"/>`,
  "トラベル":         `<path d="m17.8 19.2 1-1-3.4-2.7-.1-4.1c0-1.4-.6-2.7-1.6-3.7L9.5 3.5a1 1 0 0 0-1.7.7v4.2L3.1 6.9a1 1 0 0 0-1.1.2l-.4.4a1 1 0 0 0 .1 1.5l4.1 3.2H2.4a1 1 0 0 0-.7 1.7l3.5 3.5c1 1 2.3 1.6 3.7 1.6l4.1.1 2.7 3.4 1-1-1-4Z"/>`,
  "ホームセンター":   `<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>`,
  "ファッション":     `<path d="M20.4 14.5 16 10l4-4-3-3-5 5-5-5-3 3 4 4-4.4 4.5c-.4.4-.4 1 0 1.4l2.6 2.6c.4.4 1 .4 1.4 0L11 15v7h6v-7l3.4 3.5c.4.4 1 .4 1.4 0l2.6-2.6c.4-.4.4-1 0-1.4Z"/>`,
  "ネット通販":       `<circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/><path d="M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.6L21 8H6"/>`,
  "交通":             `<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><circle cx="8.5" cy="15.5" r="0.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="0.5" fill="currentColor"/>`,
  "その他":           `<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>`,
};

// カテゴリ表示名（すべて2行に揃えて高さを統一する。
// 自然に2行にならないものは、2行目を空白にして高さを合わせる）
const CATEGORY_CHIP_LABELS = {
  "コンビニ":         "コンビニ\n\u00A0",
  "飲食店（すべて）": "飲食店\n\u00A0",
  "飲食店（その他）": "飲食店\nその他",
  "ファストフード":   "ファスト\nフード",
  "牛丼・定食":       "牛丼\n定食",
  "ファミレス":       "ファミレス\n\u00A0",
  "回転寿司":         "回転寿司\n\u00A0",
  "カフェ":           "カフェ\n\u00A0",
  "スーパー":         "スーパー\n\u00A0",
  "ドラッグストア":   "ドラッグ\nストア",
  "自販機":           "自販機\n\u00A0",
  "エンタメ":         "エンタメ\n\u00A0",
  "トラベル":         "トラベル\n\u00A0",
  "ホームセンター":   "ホーム\nセンター",
  "ファッション":     "ファッション\n\u00A0",
  "ネット通販":       "ネット\n通販",
  "交通":             "交通\n\u00A0",
  "その他":           "その他\n\u00A0",
};

function categoryChipIcon(cat){
  const path = CATEGORY_CHIP_ICONS[cat] || CATEGORY_CHIP_ICONS["その他"];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;display:block;">${path}</svg>`;
}

function renderCategoryChips(){
  const row = document.getElementById("categoryChipRow");
  row.innerHTML = "";

  // 「すべて」チップ
  const allChip = document.createElement("button");
  allChip.className = "category-chip" + (storeState.category === "all" ? " active" : "");
  allChip.innerHTML = `${categoryChipIcon("すべて")}<span style="margin-top:2px;white-space:pre-line;text-align:center;">すべて\n\u00A0</span>`;
  allChip.addEventListener("click", ()=>{ storeState.category = "all"; renderStores(); });
  row.appendChild(allChip);

  CATEGORY_LIST.forEach(cat => {
    const count = cat === "飲食店（すべて）"
      ? STORES.filter(s => FOOD_SUBCATEGORIES.includes(s.category)).length
      : STORES.filter(s => s.category === cat).length;
    if(count === 0) return;
    const label = CATEGORY_CHIP_LABELS[cat] || `${cat}\n\u00A0`;
    const chip = document.createElement("button");
    chip.className = "category-chip" + (storeState.category === cat ? " active" : "");
    chip.innerHTML = `${categoryChipIcon(cat)}<span style="margin-top:2px;white-space:pre-line;text-align:center;">${label}</span>`;
    chip.addEventListener("click", ()=>{ storeState.category = cat; renderStores(); });
    row.appendChild(chip);
  });
}

// 特約店として登録がない店向けの「どこでも使える最強の決済」。
// 未登録店で「見つかりません」と突き放さないための受け皿。
function bestUniversalCards(){
  const pool = UNIVERSAL_PAYMENTS.concat(
    CHARGE_ROUTES.filter(r => r.atStore).map(r => ({
      name: r.name, rate: r.atStore.rate, method: r.atStore.method,
      note: r.note, url: r.url, universal: true, isRoute: true, shutdownWarn: r.shutdownWarn || null
    }))
  );
  const mine = pool.filter(c => ownsCard(c.name));
  const use = mine.length ? mine : pool;
  return [...use].sort((a,b) => rateValue(b) - rateValue(a));
}

// ========== ネット通販（ポイントサイト経由） ==========
// 経由するだけで上乗せされる仕組み。還元率は案件ごとに日々変わるため、
// 固定の数値は載せず「どこを比較すべきか」を示す方針にしている。
const POINT_SITES = [
  {
    name: "モッピー",
    strength: "案件数が最多。クレカ発行・FX・証券口座など高額案件に強い",
    detail: "運営は東証プライム上場の株式会社セレス。会員1,200万人超、常時5,000件以上の案件。楽天市場は1.0%（他社と同率）だが、買い回り時に一括決済でも全ショップ分に付く点が扱いやすい。ゴールド会員なら獲得ポイントの15%が上乗せ。［確認日: 2026-08-09］",
    url: "https://pc.moppy.jp/"
  },
  {
    name: "ハピタス",
    strength: "日常のネットショッピング向き。「お買い物あんしん保証」がある",
    detail: "ポイントが判定中のまま進まない・通帳に記載されないといったトラブルに対応する保証制度が特徴で、ゴールド会員なら問い合わせから14日以内に付与される。通常の交換上限は月3万ptだが、Pollet経由なら月30万ptまで。［確認日: 2026-08-09］",
    url: "https://hapitas.jp/"
  },
  {
    name: "ポイントインカム",
    strength: "還元率が高めの案件が多く、メガ割連動も強い",
    detail: "モッピー・ハピタスと取扱い企業が異なることがあるため、目当ての案件がない場合の選択肢になる。Qoo10のメガ割など、イベント連動の特別キャンペーンを実施しやすい。［確認日: 2026-08-09］",
    url: "https://pointi.jp/"
  },
  {
    name: "ちょびリッチ",
    strength: "ショッピングも日々のコンテンツもバランスが良い",
    detail: "案件によっては他社を上回ることがある。Qoo10などで還元率が急に上がることもあるため、比較対象に入れておく価値がある。［確認日: 2026-08-09］",
    url: "https://www.chobirich.com/"
  },
  {
    name: "ワラウ",
    strength: "楽天市場など定番案件をひと通り押さえている",
    detail: "楽天市場は他社と同じ1.0%。主要サイトを複数登録しておくと、案件ごとに高い方を選べる。［確認日: 2026-08-09］",
    url: "https://warau.jp/"
  },
  {
    name: "ポイントタウン",
    strength: "GMOグループ運営で歴史が長い",
    detail: "楽天市場は1.0%。案件によっては最高還元になることがある。［確認日: 2026-08-09］",
    url: "https://www.pointtown.com/"
  },
];


function renderEC(){
  const box = document.getElementById("ecGuideBox");
  const body = document.getElementById("ecGuideBody");
  if(!box || !body) return;
  // ネット通販カテゴリを見ているときだけ出す（他のジャンルでは邪魔になるため）
  box.style.display = (storeState.category === "ネット通販") ? "" : "none";
  const lb = document.getElementById("lineBox");
  if(lb) lb.style.display = (storeState.category === "交通") ? "" : "none";

  body.innerHTML = POINT_SITES.map(s => `
    <div class="universal-item">
      <div class="universal-item-top">
        <span class="universal-name">${s.name}</span>
      </div>
      <div class="ec-strength">${s.strength}</div>
      <div class="universal-note">${s.detail}</div>
      ${linkRowHtml(s.url, s.name)}
    </div>
  `).join("") + `
    <div class="universal-item">
      <div class="universal-note"><b>還元率の変動について</b><br>
      このアプリでは、日々変わる数値を追いかけるのではなく「平常時の目安」と「跳ねる条件」を載せる方針にしています。<br><br>
      ・楽天市場のような定番のショッピング案件は各社ほぼ横並びで安定しているため、数値をそのまま載せています<br>
      ・Qoo10のメガ割のようにイベントで大きく跳ねるものは、平常時の目安と「いつ跳ねるか」を載せています。買う時期をずらすだけで効果が大きいためです<br>
      ・クレカ発行・証券口座などの高額案件はサイト間の差が大きく変動も速いため、数値は載せていません<br><br>
      いずれの場合も、購入直前に複数のサイトを見比べるのが確実です。</div>
    </div>`;
}

document.getElementById("ecGuideHead")?.addEventListener("click", ()=>{
  document.getElementById("ecGuideBox").classList.toggle("collapsed");
});

// ========== 日付連動の特典（5と0のつく日など） ==========
// 「今日はこれが有利」を自動で判定する。毎月決まった日に発生するものが対象。
// match は今日の日付(1〜31)と曜日(0=日)を受け取り、該当するかを返す。
const DAY_DEALS = [
  {
    name: "楽天市場 5と0のつく日",
    rate: "+1%（楽天カード利用で合計4倍相当）",
    where: "楽天市場",
    match: d => [5, 10, 15, 20, 25, 30].includes(d.date),
    note: "毎月5・10・15・20・25・30日。要エントリーで、楽天カードでの決済が条件。エントリーは毎回必要（1回すれば終わりではない）。ポイント付与には上限があるため、高額購入時は上限を確認しておくこと。",
    url: "https://event.rakuten.co.jp/campaign/point-up/5-0/"
  },
  {
    name: "メルカード 毎月8日 +8%",
    rate: "+8%（上限300pt）",
    where: "メルカリ／街のお店",
    match: d => d.date === 8,
    note: "毎月8日限定。要エントリー。上限300ポイントのため約3,750円の利用で頭打ちになる。電子マネー・プリペイドカードへのチャージや決済サービスへのチャージは対象外。付与ポイントの有効期限は30日と短い。",
    url: "https://card.mercari.com/"
  },
  {
    name: "イオン お客さま感謝デー 5%OFF",
    rate: "5%OFF（割引方式）",
    where: "イオン・マックスバリュなど",
    match: d => d.date === 20 || d.date === 30,
    note: "毎月20日・30日。イオンマークのカード払い、AEON Payのスマホ決済、電子マネーWAONが対象。ポイント還元ではなく会計からの割引。たばこ・切手・商品券・酒類の一部などは対象外。",
    url: "https://www.aeon.co.jp/merit/thanks_day/"
  },
  {
    name: "イオン ありが10デー",
    rate: "ポイント5倍（2.5%相当）",
    where: "イオン・マックスバリュなど",
    match: d => d.date === 10,
    note: "毎月10日。感謝デーの5%OFFとは別方式で、こちらはWAON POINTが5倍になる。",
    url: "https://www.aeon.co.jp/"
  },
  {
    name: "イトーヨーカドー ハッピーデー",
    rate: "5%OFF",
    where: "イトーヨーカドー",
    match: d => [8, 18, 28].includes(d.date),
    note: "毎月8のつく日（8日・18日・28日）。セブンカード・プラスでの支払いが条件。",
    url: "https://www.7card.co.jp/"
  },
  {
    name: "ウエルシア お客様感謝デー（ウエル活）",
    rate: "WAON POINTが1pt→1.5円相当で使える",
    where: "ウエルシア",
    match: d => d.date === 20,
    note: "毎月20日。WAON POINTを200ポイント以上使って支払うと、1ポイント=1.5円相当で使える。例：1,000ポイント消化で1,500円分の買い物ができる。事前にWAON POINTを貯めておく必要がある。還元率ではなくポイント消費時の優遇なので、ポイントが貯まっている人向け。",
    url: "https://www.welcia.co.jp/"
  },
];

function todayDeals(){
  const now = new Date();
  const d = { date: now.getDate(), day: now.getDay() };
  return DAY_DEALS.filter(x => x.match(d));
}

function renderTodayDeals(){
  const box = document.getElementById("todayBox");
  const list = document.getElementById("todayList");
  if(!box || !list) return;
  const deals = todayDeals();
  if(deals.length === 0){ box.style.display = "none"; return; }
  box.style.display = "";

  const now = new Date();
  document.getElementById("todayDate").textContent =
    `${now.getMonth() + 1}月${now.getDate()}日`;

  list.innerHTML = "";
  deals.forEach(x => {
    const el = document.createElement("div");
    el.className = "today-item";
    el.innerHTML = `
      <div class="today-item-top">
        <span class="today-name">${x.name}</span>
        <span class="today-rate">${x.rate}</span>
      </div>
      <div class="today-where">${x.where}</div>
      <div class="card-option-note">${x.note}</div>
      ${linkRowHtml(x.url, x.name)}
    `;
    list.appendChild(el);
  });
}

// ========== 「今どれで払うか」を1つだけ出す ==========
// レジ前で読む速度に耐えるよう、答えを1つに絞って大きく出す。
// 詳細を知りたい人は下の一覧を見ればいい、という役割分担にしている。
function renderAnswer(){
  const sel = document.getElementById("answerStore");
  const body = document.getElementById("answerBody");
  if(!sel || !body) return;

  // お気に入りを先頭に、その後は登録順で店を並べる
  const favList = STORES.filter(s => isFav(s.name));
  const rest = STORES.filter(s => !isFav(s.name));
  const ordered = [...favList, ...rest];

  const stamp = `${ordered.length}:${favs.size}:${document.getElementById("answerFilter")?.value || ""}`;
  if(sel.dataset.stamp !== stamp){
    const cur = sel.value;
    sel.dataset.stamp = stamp;
    const q = (document.getElementById("answerFilter")?.value || "").trim().toLowerCase();
    const list = q ? ordered.filter(s => s.name.toLowerCase().includes(q)) : ordered;
    const favList2 = list.filter(s => isFav(s.name));
    const byCat = {};
    list.filter(s => !isFav(s.name)).forEach(s => { (byCat[s.category] = byCat[s.category] || []).push(s); });
    const opt = s => `<option value="${escapeAttr(s.name)}">${escapeHtml(s.name)}</option>`;
    sel.innerHTML = `<option value="">お店を選ぶ…</option>`
      + `<option value="__other__">その他のお店（特約なし）</option>`
      + (favList2.length ? `<optgroup label="★ よく行く店">${favList2.map(opt).join("")}</optgroup>` : "")
      + CATEGORY_LIST.filter(c => byCat[c])
          .map(c => `<optgroup label="${c}">${byCat[c].map(opt).join("")}</optgroup>`).join("");
    if(cur) sel.value = cur;
  }

  // 特約がない店：全店共通の決済から最適解を出す
  if(sel.value === "__other__"){
    const list = bestUniversalCards();
    const top = list[0];
    const y = top ? yenBack(top) : null;
    body.innerHTML = `
      <div class="answer-card">
        <div class="answer-generic-note">特約のないお店では、どこでも使える決済のなかで一番おトクなものを選びます。</div>
        <div class="answer-rate">${top.rate}${y !== null ? `<span class="answer-yen">${y.toLocaleString()}円分</span>` : ""}</div>
        <div class="answer-name">${top.name}</div>
        <div class="answer-method">${top.method || ""}</div>
        ${linkRowHtml(top.url, top.name)}
        ${list.length > 1 ? `<div class="answer-alts">
          <div class="answer-alts-head">次点</div>
          ${list.slice(1, 4).map(c => `<div class="answer-alt">
            <span class="answer-alt-rate">${c.rate}</span>
            <span class="answer-alt-name">${c.name}</span>
          </div>`).join("")}
        </div>` : ""}
      </div>`;
    return;
  }

  const store = STORES.find(s => s.name === sel.value);
  if(!store){
    body.innerHTML = `<div class="answer-empty">お店を選ぶと、いま一番おトクな払い方を表示します。<br>登録のないお店は「その他のお店」を選んでください。</div>`;
    return;
  }

  const cards = combinedCards(store);
  if(!cards.length){
    body.innerHTML = `<div class="answer-empty">このお店の情報がまだ登録されていません。</div>`;
    return;
  }
  const best = [...cards].sort((a,b) => rateValue(b) - rateValue(a))[0];
  const y = yenBack(best);
  const st = campaignStatus(best);

  body.innerHTML = `
    <div class="answer-card">
      <div class="answer-rate">${best.rate}${y !== null ? `<span class="answer-yen">${y.toLocaleString()}円分</span>` : ""}</div>
      <div class="answer-name">${best.name}</div>
      <div class="answer-method">${best.method || ""}</div>
      ${st.kind !== "permanent" ? `<div class="answer-badges">${expiryBadgeHtml(best)}</div>` : ""}
      ${/エントリー|獲得/.test((best.note || "") + (best.method || ""))
        ? `<div class="answer-warn">⚠ 事前のエントリー・クーポン獲得が必要です。済ませていないと還元されません。</div>` : ""}
      ${linkRowHtml(best.url, best.name)}
    </div>
  `;
}

// ========== 三菱UFJカードの還元率シミュレーター ==========
// 「最大20%」は条件の積み上げで、人によって実際の還元率が大きく変わる。
// 一律の数字を出すより、自分の条件を入れて計算できる方が正確。
const MUFG_CONDS = [
  { g: "カード利用", label: "MDCアプリに月1回以上ログイン", v: 0.5, easy: true },
  { g: "カード利用", label: "月5万円以上のカード利用", v: 0.5, easy: true, hint: "公共料金や携帯料金の支払いを寄せると届きやすい" },
  { g: "カード利用", label: "Apple Pay（QUICPay）利用、またはグローバルポイントWalletへのチャージ", v: 0.5, easy: true },
  { g: "カード利用", label: "楽Pay登録／リボ・分割1万円以上／カードローン1万円以上", v: 2.0, warn: true, hint: "リボ払い系。手数料が発生するリスクがあり、仕組みを理解できる人向け" },
  { g: "MUFGグループ", label: "三菱UFJダイレクトに月1回以上ログイン", v: 1.0, easy: true },
  { g: "MUFGグループ", label: "三菱UFJ銀行で給与・年金を受け取る", v: 1.0 },
  { g: "MUFGグループ", label: "MUFGグループで月1万円以上の積立投資", v: 1.0 },
  { g: "MUFGグループ", label: "三菱UFJ銀行の住宅ローン契約がある", v: 1.0 },
  { g: "MUFGグループ", label: "COIN+対応アプリに三菱UFJ銀行口座を登録", v: 0.5, easy: true, hint: "エアウォレットで口座登録するだけ" },
  { g: "固定費のカード払い", label: "携帯電話料金", v: 1.0 },
  { g: "固定費のカード払い", label: "電気料金", v: 1.0 },
  { g: "固定費のカード払い", label: "Appleのサービス（App Store・iCloud+など）", v: 1.0 },
  { g: "固定費のカード払い", label: "ABEMAプレミアム", v: 1.0 },
  { g: "固定費のカード払い", label: "その他の対象サービス", v: 1.0 },
];

const MUFG_KEY = "kangenchou_mufg";
let mufgChecked = loadSet(MUFG_KEY) || new Set();

function mufgRate(){
  let add = 0;
  MUFG_CONDS.forEach((c, i) => { if(mufgChecked.has(String(i))) add += c.v; });
  // 固定費のカード払いは最大+5.0%まで
  return Math.min(7 + add, 20);
}

function renderMufg(){
  const box = document.getElementById("mufgBox");
  const body = document.getElementById("mufgBody");
  if(!box || !body) return;

  // 三菱UFJカードを持っている人にだけ、還元率シミュレーターを出す
  // （旧「持っているカード」パネル削除時にここの表示切替が連動して壊れていたため、ここで直接判定する。
  //   wallet は null＝未設定（全カード表示）を意味するので、その場合は出さない）
  box.style.display = (wallet && [...wallet].some(w => /三菱UFJ/.test(w))) ? "" : "none";

  const rate = mufgRate();
  document.getElementById("mufgRate").textContent = rate.toFixed(1) + "%";

  const groups = {};
  MUFG_CONDS.forEach((c, i) => { (groups[c.g] = groups[c.g] || []).push({ ...c, i }); });

  body.innerHTML = Object.entries(groups).map(([g, items]) => `
    <div class="mufg-group">
      <div class="mufg-group-label">${g}</div>
      ${items.map(c => `
        <label class="mufg-item${mufgChecked.has(String(c.i)) ? " on" : ""}${c.warn ? " is-warn" : ""}">
          <input type="checkbox" data-mufg="${c.i}" ${mufgChecked.has(String(c.i)) ? "checked" : ""}>
          <span class="mufg-label">${c.label}${c.easy ? '<span class="mufg-easy">かんたん</span>' : ""}
            ${c.hint ? `<span class="mufg-hint">${c.hint}</span>` : ""}</span>
          <span class="mufg-v">+${c.v}%</span>
        </label>`).join("")}
    </div>`).join("");

  body.querySelectorAll("[data-mufg]").forEach(el => {
    el.addEventListener("change", ()=>{
      const k = el.dataset.mufg;
      if(mufgChecked.has(k)) mufgChecked.delete(k); else mufgChecked.add(k);
      saveSet(MUFG_KEY, mufgChecked);
      renderMufg();
      renderStores();
    });
  });
}

document.getElementById("mufgHead")?.addEventListener("click", (e)=>{
  if(e.target.closest(".mufg-item")) return;
  document.getElementById("mufgBox").classList.toggle("collapsed");
});

function renderStores(){
  renderAnswer();
  renderEC();
  renderMufg();
  renderCategoryChips();

  const list = document.getElementById("storeList");
  const emptyNote = document.getElementById("storeEmptyNote");
  list.innerHTML = "";

  const q = storeState.search.toLowerCase();
  let filtered = STORES.filter(s =>
    (storeState.category === "all" || matchesCategory(s.category, storeState.category)) &&
    (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
  );

  document.getElementById("storeCountLine").textContent = `登録店舗 ${STORES.length}件中 ${filtered.length}件を表示`;

  if(filtered.length === 0){
    emptyNote.style.display = "block";
    return;
  }
  emptyNote.style.display = "none";

  // お気に入りは常に最上部に固定（検索・絞り込み中は通常の並びに任せる）
  const showFavSection = !q && storeState.category === "all" && !storeState.sortByRate;
  if(showFavSection){
    const favStores = filtered.filter(s => isFav(s.name));
    if(favStores.length){
      const label = document.createElement("div");
      label.className = "store-category-label";
      label.textContent = "★ よく行く店";
      list.appendChild(label);
      favStores.forEach(store => {
        const card = buildStoreCardEl(store);
        card.classList.remove("collapsed");
        list.appendChild(card);
      });
      filtered = filtered.filter(s => !isFav(s.name));
    }
  }

  // 検索中は無関係な広告が紛れ込むと邪魔なので、絞り込みが掛かっていないときだけ広告を挟む。
  const showAds = !q;
  let adPool = [...STORE_AD_SLOTS];
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
  shuffle(adPool);
  let adCursor = 0;
  const AD_INTERVAL = 5; // 実店舗カード5件ごとに1枠
  function maybeInsertAd(realCardCount){
    if(!showAds || !adPool.length) return;
    if(realCardCount === 0 || realCardCount % AD_INTERVAL !== 0) return;
    for(let tries=0; tries<adPool.length; tries++){
      const slot = adPool[adCursor % adPool.length];
      adCursor++;
      const adEl = buildAdCardEl(slot);
      if(adEl){ list.appendChild(adEl); return; }
    }
  }

  if(storeState.sortByRate){
    // 還元率が高い順：カテゴリ見出しは出さず、フラットに並べる
    filtered = [...filtered].sort((a,b) => storeBestRate(b) - storeBestRate(a));
    filtered.forEach((store, i) => {
      const card = buildStoreCardEl(store);
      card.classList.remove("collapsed");
      list.appendChild(card);
      maybeInsertAd(i + 1);
    });
    return;
  }

  let lastCategory = null;
  let realCardCount = 0;
  filtered.forEach(store => {
    if(store.category !== lastCategory){
      const label = document.createElement("div");
      label.className = "store-category-label";
      label.textContent = store.category;
      list.appendChild(label);
      lastCategory = store.category;
    }
    const card = buildStoreCardEl(store);
    card.classList.remove("collapsed"); // keep list view expanded by default, as before
    list.appendChild(card);
    realCardCount++;
    maybeInsertAd(realCardCount);
  });
}

document.getElementById("sortToggleBtn").addEventListener("click", ()=>{
  storeState.sortByRate = !storeState.sortByRate;
  document.getElementById("sortToggleBtn").setAttribute("aria-checked", String(storeState.sortByRate));
  renderStores();
});

document.getElementById("storeSearch").addEventListener("input", (e)=>{
  storeState.search = e.target.value.trim();
  renderStores();
});

document.querySelectorAll(".mode-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".mode-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".mode-panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.mode}`).classList.add("active");
  });
});

document.getElementById("showUniversalChk").addEventListener("change", (e)=>{
  showUniversal = e.target.checked;
  renderStores();
});


let campaignCategory = "all";

// キャンペーンがある店舗のカテゴリだけをチップとして出す（空振りを作らない）
function renderCampaignChips(){
  const row = document.getElementById("campaignChipRow");
  if(!row) return;
  const showExpired = document.getElementById("showExpiredChk").checked;
  const counts = {};
  let total = 0;
  STORES.forEach(store => {
    store.cards.forEach(card => {
      const st = campaignStatus(card);
      if(st.kind === "permanent") return;
      if(st.kind === "expired" && !showExpired) return;
      counts[store.category] = (counts[store.category] || 0) + 1;
      total++;
    });
  });

  row.innerHTML = "";
  const mk = (key, label, count) => {
    const b = document.createElement("button");
    b.className = "category-chip" + (campaignCategory === key ? " active" : "");
    b.innerHTML = `${label} <span class="chip-count">${count}</span>`;
    b.addEventListener("click", ()=>{ campaignCategory = key; renderCampaigns(); });
    row.appendChild(b);
  };
  mk("all", "すべて", total);
  CATEGORY_LIST.forEach(cat => { if(counts[cat]) mk(cat, cat, counts[cat]); });
}

// ========== エントリー忘れ防止チェックリスト ==========
// Vクーポンやかっぱ寿司のように「エントリーしないと還元0」のものが複数あるため、
// 対象を自動で拾い出してチェックリスト化する。チェック状態は端末に保存する。
const ENTRY_DONE_KEY = "kangenchou_entry_done";
let entryDone = loadSet(ENTRY_DONE_KEY) || new Set();

// エントリー・クーポン獲得が要りそうなものを、文言から判定して集める
function needsEntryItems(){
  const items = [];
  const re = /エントリー|クーポンを獲得|事前に.*獲得|要エントリー/;
  MONTHLY_PICKS.forEach(p => {
    if(campaignStatus(p).kind === "expired") return;
    const text = (p.note || "") + (p.how || []).join("");
    if(re.test(text)) items.push({ key: "pick:" + p.name, label: p.name, sub: p.period || "", url: p.url });
  });
  STORES.forEach(s => s.cards.forEach(c => {
    if(!c.expires) return;
    if(campaignStatus(c).kind === "expired") return;
    const text = (c.note || "") + (c.method || "");
    if(re.test(text)) items.push({
      key: "store:" + s.name + ":" + c.name,
      label: s.name + "　" + c.rate,
      sub: c.name, url: c.url
    });
  }));
  return items;
}

function renderEntryChecks(){
  const list = document.getElementById("entryCheckList");
  if(!list) return;
  const items = needsEntryItems();
  list.innerHTML = "";

  if(items.length === 0){
    list.innerHTML = `<div class="store-empty-note">エントリーが必要なキャンペーンはありません。</div>`;
    return;
  }

  const remaining = items.filter(i => !entryDone.has(i.key)).length;
  const head = document.createElement("div");
  head.className = "entry-progress";
  head.textContent = remaining === 0
    ? `✅ ${items.length}件すべて完了しています`
    : `未完了 ${remaining}件 / 全${items.length}件`;
  list.appendChild(head);

  items.forEach(i => {
    const done = entryDone.has(i.key);
    const el = document.createElement("div");
    el.className = "entry-item" + (done ? " done" : "");
    el.innerHTML = `
      <button class="entry-check" aria-pressed="${done}">${done ? "✓" : ""}</button>
      <div class="entry-body">
        <div class="entry-label">${escapeHtml(i.label)}</div>
        <div class="entry-sub">${escapeHtml(i.sub)}</div>
      </div>
      ${(i.url && isSafeHttpUrl(i.url)) ? `<a class="src-link" href="${escapeAttr(i.url)}" target="_blank" rel="noopener noreferrer">開く ↗</a>` : ""}
    `;
    el.querySelector(".entry-check").addEventListener("click", ()=>{
      if(entryDone.has(i.key)) entryDone.delete(i.key); else entryDone.add(i.key);
      saveSet(ENTRY_DONE_KEY, entryDone);
      renderEntryChecks();
    });
    list.appendChild(el);
  });
}

function renderPicks(){
  const list = document.getElementById("picksList");
  if(!list) return;
  list.innerHTML = "";
  const live = MONTHLY_PICKS.filter(p => campaignStatus(p).kind !== "expired");
  if(live.length === 0){
    list.innerHTML = `<div class="store-empty-note">今月の優先決済は登録されていません。</div>`;
    return;
  }
  live.forEach(p => {
    const el = document.createElement("div");
    el.className = "pick-card";
    el.innerHTML = `
      <div class="pick-top">
        <span class="pick-name">${escapeHtml(p.name)}</span>
        <span class="pick-rate">${escapeHtml(p.rate)}</span>
        <button class="icon-btn edit-pick-btn" title="編集">✎</button>
        <button class="icon-btn delete-pick-btn" title="削除">🗑</button>
      </div>
      <div class="pick-period">${escapeHtml(p.period)}　${expiryBadgeHtml(p)}</div>
      <ol class="pick-steps">${p.how.map(h => `<li>${escapeHtml(h)}</li>`).join("")}</ol>
      ${noteHtml(p.note)}
      ${linkRowHtml(p.url, p.name)}
    `;
    el.querySelector(".edit-pick-btn").addEventListener("click", ()=> openPickModal(p));
    el.querySelector(".delete-pick-btn").addEventListener("click", ()=> deletePick(p));
    list.appendChild(el);
  });
}

// 「今月の優先決済」の追加・編集・削除。手順は改行区切りで入力してもらう。
function openPickModal(pick){
  const isNew = pick === null;
  showModal(
    isNew ? "今月の優先決済を追加" : "優先決済を編集",
    [
      { key: "name", label: "名称（例：VポイントPay ポイント優先払いで10%還元）", value: pick ? pick.name : "" },
      { key: "rate", label: "特典（例：10%還元）", value: pick ? pick.rate : "" },
      { key: "period", label: "期間の表示（例：8/1〜8/31）", value: pick ? pick.period : "" },
      { key: "expires", label: "終了日（例：2026-08-31）", value: pick ? pick.expires : "" },
      { key: "how", label: "手順（1行に1ステップ。改行で区切る）", type: "textarea",
        value: pick ? (pick.how || []).join("\n") : "" },
      { key: "url", label: "キャンペーンページのURL", value: pick ? pick.url : "" },
      { key: "note", label: "上限・注意点", type: "textarea", value: pick ? pick.note : "" },
    ],
    (v)=>{
      const obj = {
        name: v.name, rate: v.rate, period: v.period,
        expires: v.expires || undefined,
        how: v.how ? v.how.split("\n").map(s=>s.trim()).filter(Boolean) : [],
        note: v.note, url: v.url || undefined
      };
      if(isNew) MONTHLY_PICKS.push(obj);
      else Object.assign(pick, obj);
      persistPicks();
      renderPicks();
      renderEntryChecks();
    },
    isNew ? null : ()=> deletePick(pick)
  );
}

function deletePick(pick){
  if(!confirm(`「${pick.name}」を削除しますか？`)) return;
  const i = MONTHLY_PICKS.indexOf(pick);
  if(i === -1) return;
  MONTHLY_PICKS.splice(i, 1);
  persistPicks();
  renderPicks();
}

// ===== キャンペーンページ：ヒーローカルーセル & ランキング =====
let heroIdx = 0;

function renderCampaignHero(){
  const wrap = document.getElementById("heroCarousel");
  const dots = document.getElementById("heroDots");
  if(!wrap || !dots) return;

  // DEFAULT_PICKSの最初の4件をヒーローとして使う
  const heroes = MONTHLY_PICKS.slice(0, 4);
  if(!heroes.length){ wrap.innerHTML = ""; dots.innerHTML = ""; return; }

  const h = heroes[heroIdx] || heroes[0];

  // 期間テキスト整形
  const periodText = escapeHtml(h.period || "—");
  const now = new Date();
  const updStr = `最終更新：${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}`;
  const el = document.getElementById("cmpLastUpdated");
  if(el) el.textContent = updStr;

  wrap.innerHTML = `
    <div>
      <div class="cmp-hero-top">
        <div class="cmp-hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
        </div>
        <div class="cmp-hero-body">
          <span class="cmp-hero-badge">おすすめ</span>
          <div class="cmp-hero-title">${escapeHtml(h.name)}</div>
          <div class="cmp-hero-desc">${escapeHtml(h.how && h.how.length ? h.how[0] : "")}</div>
        </div>
        <svg class="cmp-hero-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </div>
      <div class="cmp-hero-meta">
        <div class="cmp-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>エントリー${(h.how||[]).some(s=>s.includes("エントリー")) ? "必要" : "不要"}</span>
        </div>
        <div class="cmp-meta-divider"></div>
        <div class="cmp-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${periodText}</span>
        </div>
        <div class="cmp-meta-divider"></div>
        <div class="cmp-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>${escapeHtml(h.rate || "—")}</span>
        </div>
      </div>
      <button class="cmp-hero-cta" data-hero-url="${escapeAttr(isSafeHttpUrl(h.url) ? h.url : "")}">
        このキャンペーンをチェックする
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  `;
  // onclick文字列にURLを直接埋め込むと属性エスケープが崩れた際にスクリプト実行につながるため、
  // data属性で受け渡してからJSでイベントを登録する。
  const heroCta = wrap.querySelector(".cmp-hero-cta");
  if(heroCta){
    heroCta.addEventListener("click", ()=>{
      const url = heroCta.dataset.heroUrl;
      if(url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  dots.innerHTML = heroes.map((_, i) =>
    `<div class="cmp-dot${i===heroIdx?" active":""}" data-i="${i}"></div>`
  ).join("");
  dots.querySelectorAll(".cmp-dot").forEach(d => {
    d.addEventListener("click", ()=>{ heroIdx = parseInt(d.dataset.i); renderCampaignHero(); });
  });
}

function renderCampaignRanking(){
  const list = document.getElementById("cmpRankingList");
  if(!list) return;

  // MONTHLY_PICKSから最大還元率が高い上位3件をランキング表示
  const ranked = [...MONTHLY_PICKS]
    .map(p => {
      const rateStr = String(p.rate||"");
      const m = rateStr.match(/(\d+(?:\.\d+)?)/);
      const isPercent = /%/.test(rateStr);
      return { p, v: m ? parseFloat(m[1]) : 0, isPercent };
    })
    .sort((a,b)=> b.v - a.v)
    .slice(0, 3);

  const RANK_COLORS = ["#F59E0B","#94A3B8","#B45309"];
  const RANK_ICONS = [
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  ];
  const SVC_ICONS = [
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4"/><rect x="16" y="12" width="6" height="5" rx="1"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>`,
  ];

  list.innerHTML = ranked.map(({p, v, isPercent}, i) => `
    <div class="cmp-rank-card" data-slug="${escapeAttr(p.slug || "")}" style="cursor:pointer;">
      <div class="cmp-rank-badge" style="background:${RANK_COLORS[i]};">
        <span style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;">${RANK_ICONS[i]}</span>
        <span>${i+1}</span>
      </div>
      <div class="cmp-rank-svc-icon">${SVC_ICONS[i]}</div>
      <div class="cmp-rank-mid">
        <div class="cmp-rank-name">${escapeHtml(p.name.slice(0, 20))}${p.name.length>20?"…":""}</div>
        <div class="cmp-rank-stars">★★★★${i===0?"★":"☆"} ${(4.8-i*0.2).toFixed(1)}</div>
        <div class="cmp-rank-desc">${p.how && p.how[0] ? escapeHtml(p.how[0].slice(0,24))+"…" : ""}</div>
      </div>
      <div class="cmp-rank-right">
        <div class="cmp-rank-label">最大</div>
        <div class="cmp-rank-rate">${v}${isPercent ? "%" : "pt"}</div>
        <div class="cmp-rank-rate-sub">${isPercent ? "還元" : "獲得"}</div>
      </div>
      <svg class="cmp-rank-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `).join("");

  // カード（＞マーク含む）をタップすると、articles/ 配下の静的記事ページへ遷移する。
  // ハッシュルーティングだとクローラーから見て「別ページ」と認識されにくいため、実ファイルへ直接飛ばす。
  // slugは管理画面から自由入力できるため、英数字・ハイフン・アンダースコアのみを許可し、
  // パストラバーサル（../等）や別オリジンへの誘導に使われないようにする。
  const SAFE_SLUG = /^[A-Za-z0-9_-]+$/;
  list.querySelectorAll(".cmp-rank-card").forEach(card => {
    card.addEventListener("click", () => {
      const slug = card.dataset.slug;
      if(slug && SAFE_SLUG.test(slug)) location.href = `articles/${slug}.html`;
    });
  });
}

function renderCampaigns(){
  renderCampaignHero();
  renderCampaignRanking();
  const list = document.getElementById("campaignList");
  list.innerHTML = "";

  // 期限が設定されているものだけを集め、終了が近い順に並べる
  const items = [];
  STORES.forEach(store => {
    if(campaignCategory !== "all" && store.category !== campaignCategory) return;
    store.cards.forEach(card => {
      const st = campaignStatus(card);
      if(st.kind === "permanent") return;
      if(st.kind === "expired" && !document.getElementById("showExpiredChk").checked) return;
      items.push({ store, card, status: st });
    });
  });
  renderCampaignChips();
  items.sort((a,b) => (a.status.days ?? 0) - (b.status.days ?? 0));

  document.getElementById("campaignCountLine").textContent =
    items.length ? `${items.length}件のキャンペーン` : "";

  if(items.length === 0){
    list.innerHTML = `<div class="store-empty-note">期間限定のキャンペーンは登録されていません。<br>「お店から探す」の編集モードで、終了日を設定すると，ここに表示されます。</div>`;
    return;
  }

  items.forEach(({ store, card, status }) => {
    const el = document.createElement("div");
    el.className = "campaign-card" + (status.kind === "expired" ? " is-expired" : "");

    // 最終確認日をnoteから抽出して表示
    const checkedMeta = sourceMetaHtml(card.note);

    el.innerHTML = `
      <div class="campaign-card-top">
        <span class="campaign-store">${escapeHtml(store.name)}</span>
        ${expiryBadgeHtml(card)}
        <span class="campaign-rate">${escapeHtml(card.rate)}</span>
        ${editMode ? `
          <button class="icon-btn edit-campaign-btn" title="このキャンペーンを編集" style="margin-left:auto;">✎</button>
          <button class="icon-btn delete-campaign-btn" title="このキャンペーンを削除">🗑</button>
        ` : ""}
      </div>
      <div class="campaign-cardname">${escapeHtml(card.name)}　／　${escapeHtml(card.method || "")}</div>
      <div class="campaign-date-row">
        ${card.expires ? `<span class="campaign-date-item"><span class="campaign-date-label">終了日</span>${escapeHtml(card.expires)}</span>` : `<span class="campaign-date-item"><span class="campaign-date-label">期間</span>常設</span>`}
        ${checkedMeta || ""}
      </div>
      ${card.note ? noteHtml(card.note, {className: "campaign-note"}) : ""}
      ${(card.image && isSafeHttpUrl(card.image)) ? `<img src="${escapeAttr(card.image)}" alt="${escapeAttr(card.name)}" class="campaign-card-image" loading="lazy">` : ""}
      <div class="link-row">
        ${(card.articleUrl && isSafeHttpUrl(card.articleUrl)) ? `<a class="src-link" href="${escapeAttr(card.articleUrl)}">詳しくはこちら →</a>` : ""}
        ${(card.url && isSafeHttpUrl(card.url)) ? `<a class="src-link campaign-link" href="${escapeAttr(card.url)}" target="_blank" rel="noopener noreferrer">キャンペーンを見る ↗</a>` : ""}
        ${(affiliateFor(card.name) && isSafeHttpUrl(affiliateFor(card.name))) ? `<a class="src-link apply-link" href="${escapeAttr(affiliateFor(card.name))}" target="_blank" rel="sponsored noopener noreferrer">申し込み ↗</a>` : ""}
      </div>
    `;
    if(editMode){
      el.querySelector(".edit-campaign-btn")?.addEventListener("click", ()=> openCardModal(store, card));
      el.querySelector(".delete-campaign-btn")?.addEventListener("click", ()=> deleteCard(store, card));
    }
    list.appendChild(el);
  });
}

let routeFilter = "all";

// ルートに紐づく決済手段でチップを作る。「楽天ペイならどのルート？」を引けるようにする。
const ROUTE_CHIP_ICONS = {
  "すべて":    `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>`,
  "ANA Pay":   `<path d="m17.8 19.2 1-1-3.4-2.7-.1-4.1c0-1.4-.6-2.7-1.6-3.7L9.5 3.5a1 1 0 0 0-1.7.7v4.2L3.1 6.9a1 1 0 0 0-1.1.2l-.4.4a1 1 0 0 0 .1 1.5l4.1 3.2H2.4a1 1 0 0 0-.7 1.7l3.5 3.5c1 1 2.3 1.6 3.7 1.6l4.1.1 2.7 3.4 1-1-1-4Z"/>`,
  "au PAY":    `<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>`,
  "楽天ペイ":  `<path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 21v-6h6v6"/>`,
  "楽天Edy":   `<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4"/><rect x="16" y="12" width="6" height="5" rx="1"/>`,
  "Suica":     `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>`,
  "ICOCA":     `<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/>`,
  "WAON":      `<circle cx="12" cy="9" r="4"/><path d="M9 12c-3 1-5 3-5 6h16c0-3-2-5-5-6"/>`,
  "Revolut":   `<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a2.5 2.5 0 0 1 0 5H9m4 0 3 5"/>`,
  "税金・公共料金": `<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>`,
  "交通系IC":  `<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/>`,
  "ふるさと納税": `<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>`,
};
const DEFAULT_ROUTE_ICON = `<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>`;

function routeChipIconSvg(key){
  const path = ROUTE_CHIP_ICONS[key] || DEFAULT_ROUTE_ICON;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;display:block;">${path}</svg>`;
}

function renderRouteChips(){
  const row = document.getElementById("routeChipRow");
  if(!row) return;
  const counts = {};
  CHARGE_ROUTES.forEach(r => (r.pays || []).forEach(p => counts[p] = (counts[p]||0)+1));

  row.innerHTML = "";
  const mk = (key, label) => {
    const b = document.createElement("button");
    b.className = "category-chip" + (routeFilter === key ? " active" : "");
    b.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 12px;min-width:56px;";
    b.innerHTML = `${routeChipIconSvg(key)}<span style="margin-top:2px;white-space:pre-line;text-align:center;font-size:10px;">${label}</span>`;
    b.addEventListener("click", ()=>{ routeFilter = key; renderRoutes(); });
    row.appendChild(b);
  };
  mk("all", "すべて");
  Object.keys(counts).sort((a,b)=> counts[b]-counts[a]).forEach(p => mk(p, p));
}

// ルートを通したとき、どのポイントに何ポイント入るかを分けて出す。
// 「合計2.5%」だけだと、ANAマイルと楽天ポイントが混ざっていることが見えないため。
// ========== チャージの起点カード ==========
// 同じルートでも起点のカードで還元率も貯まるポイントも変わる。
// 「NLだと付かない」まで分かる形にするための一覧。
const STARTER_CARDS = [
  { name: "指定なし（基準）", rate: null, pt: "" },
  { name: "V NEOBANKデビット（住信SBI）", rate: 1.5, pt: "Vポイント",
    note: "⚠️ 2026年11月1日から他社決済サービスへのチャージがポイント対象外になります。チャージ起点としては10月31日が期限です。" },
  { name: "カテエネBANKデビット", rate: 2.0, pt: "カテエネポイント",
    note: "月末残高200万円以上の条件で還元率2.0%。中部電力契約不要。カテエネポイントはVポイント・楽天ポイント・dポイント・Pontaなどへ等価交換可能。V NEOBANK廃止後の有力な代替起点。" },
  { name: "エポスゴールド", rate: 0, pt: "エポスポイント",
    note: "⚠️ 2026年8月1日からANA Pay・au PAY・楽天Edy・Revolut等へのチャージがポイント対象外（0%）になりました。チャージ起点としては現在使えません。" },
  { name: "リクルートカード", rate: 1.2, pt: "リクルートポイント",
    note: "年会費無料。電子マネーチャージにポイントが付く数少ないカードですが、月間の付与上限があります。" },
  { name: "J-WESTカード ゴールド", rate: 3.0, pt: "WESTERポイント",
    note: "モバイルICOCAへのチャージ限定で3倍です。他のチャージ先では通常還元にとどまります。" },
  { name: "楽天カード", rate: 1.0, pt: "楽天ポイント",
    note: "チャージ先によっては対象外になることがあります。" },
  { name: "三井住友カード（NL）", rate: 0.5, pt: "Vポイント",
    note: "Revolut経由なら0.5%還元（Mastercard版のみ・手数料無料）。ANA Pay・au PAY・JAL Payへの直接チャージはポイント対象外。" },
  { name: "PayPayカード", rate: 0, pt: "PayPayポイント",
    note: "2026年6月から他社決済サービスへのチャージは対象外になりました。" },
  { name: "JQセゾン(JCB)", rate: 1.5, pt: "永久不滅ポイント等",
    note: "ファミペイチャージで1.5%（月2万円まで）。IDAREルートなどの起点として使えます。楽天カード・PayPayカードでも代用できますが還元率は変わります。" },
];
let starterIdx = 0;

// 起点カード・経由地の選び方を「リスト（プルダウン）」か「ボタン」かで切り替えられるようにする。
// 端末に保存して次回も覚えておく。
const PICKER_MODE_KEY = "kangenchou_picker_mode";
let pickerMode = localStorage.getItem(PICKER_MODE_KEY) || "list"; // "list" | "button"
function setPickerMode(mode){
  pickerMode = mode;
  try{ localStorage.setItem(PICKER_MODE_KEY, mode); }catch(e){}
  renderRoutes();
}

// ========== 経由地（waypoint）から選ぶ ==========
// 「IDAREを経由地として使いたい」のように、起点ではなく途中のノードで
// ルートを絞り込みたいケースに対応する。全ルートのstepsから、起点（先頭）と
// 末尾の行動ステップを除いた「中間ノード」をユニークに集めて選択肢にする。
let waypointName = null; // null = 指定なし
function getWaypointOptions(){
  const set = new Set();
  (CHARGE_ROUTES || []).forEach(r => {
    const steps = r.steps || [];
    steps.slice(1, -1).forEach(s => {
      if(WALLET_OPTIONS_EXCLUDE.has(s) || isDescriptiveStep(s)) return;
      set.add(s);
    });
  });
  return [...set].sort();
}
function routeHasWaypoint(route){
  if(!waypointName) return true;
  return (route.steps || []).includes(waypointName);
}

// 選んだ経由地から、どの決済へ進めるか（＝そのノードの次のステップ）を集める。
// 「経由したい決済を選択できるようにする」の部分：経由地を選んだ後、
// さらにそこから先の行き先を絞りたい場合に使う。
function getDestinationOptionsFor(waypoint){
  const set = new Set();
  (CHARGE_ROUTES || []).forEach(r => {
    const steps = r.steps || [];
    const idx = steps.indexOf(waypoint);
    if(idx >= 0 && idx + 1 < steps.length){
      const next = steps[idx + 1];
      if(!isDescriptiveStep(next)) set.add(next);
    }
  });
  return [...set].sort();
}
let destinationName = null; // null = 指定なし（経由地から先はすべて表示）

// 選んだ起点カードで、このルートが実行できるか／いくらになるかを返す。
// starters に載っていないカードでは、そもそもそのルートを組めない。
function routeWithStarter(route){
  const st = STARTER_CARDS[starterIdx];
  if(!st || st.rate === null) return { usable: true, base: null };   // 指定なし＝全部表示
  if(!route.starters) return { usable: false };
  const rate = route.starters[st.name];
  if(rate === undefined) return { usable: false };                    // このカードでは組めない
  const rest = (route.split || []).slice(1).reduce((a,s)=> a + effectiveSplitRate(s), 0);
  return { usable: true, base: rate, total: rate + rest, starter: st };
}

// 並べ替え用。起点を選んでいるときは、その起点での合計で比較する。
function routeSortValue(route){
  const w = routeWithStarter(route);
  if(w.total != null) return w.total;
  if(route.split && route.split.length){
    return route.split.reduce((a, s) => a + effectiveSplitRate(s), 0);
  }
  const m = String(route.total || "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function pickerModeToggleHtml(){
  return `<div class="picker-mode-toggle" role="group" aria-label="表示形式">
    <button type="button" class="picker-mode-btn${pickerMode==="list"?" on":""}" data-picker-mode="list">リスト</button>
    <button type="button" class="picker-mode-btn${pickerMode==="button"?" on":""}" data-picker-mode="button">ボタン</button>
  </div>`;
}

function starterPickerHtml(){
  const st = STARTER_CARDS[starterIdx];
  const body = pickerMode === "button"
    ? `<div class="starter-btn-grid">
        ${STARTER_CARDS.map((c,i)=>`<button type="button" class="starter-opt-btn${i===starterIdx?" on":""}" data-starter-idx="${i}">${c.name}</button>`).join("")}
      </div>`
    : `<select id="starterSel" class="answer-select">
        ${STARTER_CARDS.map((c,i)=>`<option value="${i}" ${i===starterIdx?"selected":""}>${c.name}</option>`).join("")}
      </select>`;

  const waypoints = getWaypointOptions();
  const destinations = waypointName ? getDestinationOptionsFor(waypointName) : [];
  const waypointBody = pickerMode === "button"
    ? `<div class="starter-btn-grid">
        <button type="button" class="starter-opt-btn${!waypointName?" on":""}" data-waypoint="">指定なし</button>
        ${waypoints.map(w=>`<button type="button" class="starter-opt-btn${w===waypointName?" on":""}" data-waypoint="${w}">${w}</button>`).join("")}
      </div>`
    : `<select id="waypointSel" class="answer-select">
        <option value="" ${!waypointName?"selected":""}>指定なし（経由地で絞り込まない）</option>
        ${waypoints.map(w=>`<option value="${w}" ${w===waypointName?"selected":""}>${w}</option>`).join("")}
      </select>`;

  const destinationBody = waypointName && destinations.length
    ? (pickerMode === "button"
      ? `<div class="starter-btn-grid" style="margin-top:8px;">
          <button type="button" class="starter-opt-btn${!destinationName?" on":""}" data-destination="">指定なし</button>
          ${destinations.map(d=>`<button type="button" class="starter-opt-btn${d===destinationName?" on":""}" data-destination="${d}">${d}</button>`).join("")}
        </div>`
      : `<select id="destinationSel" class="answer-select" style="margin-top:8px;">
          <option value="" ${!destinationName?"selected":""}>指定なし（${waypointName}から先はすべて表示）</option>
          ${destinations.map(d=>`<option value="${d}" ${d===destinationName?"selected":""}>${d}</option>`).join("")}
        </select>`)
    : "";

  return `<div class="starter-picker">
    <div class="starter-picker-head">
      <span class="mypanel-label">チャージの起点にするカード</span>
      ${pickerModeToggleHtml()}
    </div>
    ${body}
    ${st.note ? `<div class="starter-note">${st.note}</div>` : ""}

    <div class="starter-picker-head" style="margin-top:14px;">
      <span class="mypanel-label">経由地から選ぶ（例：IDAREを経由するルートだけ見る）</span>
    </div>
    ${waypointBody}
    ${destinationBody}
  </div>`;
}

// 選んだ起点カードの名前で「クレカ」などの一般名を置き換える。
// どのルートでも、いま自分が使うカード名で読めるようにするため。
function withStarterName(text){
  const st = STARTER_CARDS[starterIdx];
  if(!st || st.rate === null) return text;
  const short = st.name.replace(/（.*?）/g, "");
  return String(text)
    .replace(/対象クレカ|高還元クレカ|^クレカ$|クレカ(?=から|の|→|で)/g, short)
    .replace(/Visa\/Mastercardブランドのクレカ/g, short);
}


// 起点カードで実際にどのポイントが貯まるかを示す
function starterGainHtml(route){
  const w = routeWithStarter(route);
  if(!w.starter) return "";
  const amt = Math.max(0, parseInt(document.getElementById("routeAmount")?.value, 10) || 0);
  const got = amt ? Math.floor(amt * w.base / 100) : null;
  if(w.base === 0){
    return `<div class="starter-gain is-zero">
      <span class="starter-gain-label">${escapeHtml(w.starter.name)}を起点にした場合</span>
      このルートのチャージ分にはポイントが付きません。${escapeHtml(w.starter.note || "")}
    </div>`;
  }
  return `<div class="starter-gain">
    <span class="starter-gain-label">${escapeHtml(w.starter.name)}を起点にした場合</span>
    チャージ段階で <b>${escapeHtml(w.starter.pt)}が${w.base}%</b>${got !== null ? `（${amt.toLocaleString()}円で${got.toLocaleString()}pt）` : ""} 貯まります。
  </div>`;
}

// データの整合性チェック。内訳の合計と見出しの数字がズレていたら画面に警告を出す。
// 人が目視で突き合わせるのは現実的でないので、機械に見張らせる。
function splitMismatch(route){
  if(!route.split || !route.split.length) return null;
  const sum = route.split.reduce((a,s)=> a + s.rate, 0);
  const m = String(route.total || "").match(/(\d+(?:\.\d+)?)/);
  if(!m) return null;
  const shown = parseFloat(m[1]);
  return Math.abs(sum - shown) > 0.05
    ? `内訳の合計（${sum.toFixed(1)}%）と表示（${shown}%）が一致していません`
    : null;
}

function splitHtml(route){
  if(!route.split || !route.split.length) return "";
  const amt = Math.max(0, parseInt(document.getElementById("routeAmount")?.value, 10) || 0);
  const w = routeWithStarter(route);
  // 起点カードを選んでいれば、1段目（チャージ分）をそのカードの率とポイントに差し替える
  const rows = route.split.map((s, si) => {
    if(si === 0 && w.base != null && w.starter){
      s = { pt: w.starter.pt, rate: w.base, note: `${w.starter.name}でのチャージ分` };
    }
    const rate = effectiveSplitRate(s);
    const got = amt ? Math.floor(amt * rate / 100) : null;
    return `<div class="split-row">
      <span class="split-pt">${escapeHtml(s.pt)}</span>
      <span class="split-rate">${rate}%</span>
      ${got !== null ? `<span class="split-got">${got.toLocaleString()}</span>` : ""}
      <span class="split-note">${escapeHtml(s.note)}${rate !== s.rate ? "（楽天ペイ提示条件達成済み）" : ""}</span>
    </div>`;
  }).join("");

  const total = route.split.reduce((a, s, si) =>
    a + ((si === 0 && w.base != null) ? w.base : effectiveSplitRate(s)), 0);
  const totalGot = amt ? Math.floor(amt * total / 100) : null;

  const warn = splitMismatch(route);
  return `<div class="split-box">
    ${warn ? `<div class="split-warn">⚠ ${warn}</div>` : ""}
    <div class="split-head">貯まるポイントの内訳${amt ? `　<span class="split-amt">${amt.toLocaleString()}円を通した場合</span>` : ""}</div>
    ${rows}
    <div class="split-row is-total">
      <span class="split-pt">合計</span>
      <span class="split-rate">${total.toFixed(1)}%</span>
      ${totalGot !== null ? `<span class="split-got">${totalGot.toLocaleString()}</span>` : ""}
      <span class="split-note">${w.starter ? `${escapeHtml(w.starter.name)}を起点にした場合` : "各段階の合計"}</span>
    </div>
  </div>`;
}

// 初めての人向けの手順。経験者には不要なので、既定では畳んでおく。
function howtoHtml(route, idx){
  const h = route.howto;
  if(!h) return "";
  return `<div class="howto-box collapsed" data-howto="${idx}">
    <button class="howto-head" data-howto-toggle="${idx}">
      <span class="howto-title">はじめての人向け：やり方を見る</span>
      <span class="howto-toggle">▾</span>
    </button>
    <div class="howto-body">
      <div class="howto-sec">
        <div class="howto-sec-label">① 事前に用意するもの</div>
        <ol class="howto-list">${h.prep.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ol>
      </div>
      <div class="howto-sec">
        <div class="howto-sec-label">② 毎回の流れ</div>
        <ol class="howto-list">${h.flow.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ol>
      </div>
      ${h.time ? `<div class="howto-time">⏱ ${escapeHtml(h.time)}</div>` : ""}
    </div>
  </div>`;
}

// ルート見出しの合計表示。起点カードを選んでいれば、そのカードでの実数を出す。
// 「約2.7%（カードによる）」ではなく「2.5%（楽天カード起点）」と具体的に示す。
function routeTotalLabel(route){
  const w = routeWithStarter(route);
  if(w.total != null && w.starter){
    const short = w.starter.name.replace(/（.*?）/g, "");
    return `${w.total.toFixed(1)}%（${short}起点）`;
  }
  // 起点未指定でも、楽天ペイの提示条件チェックなどsplit側の調整があれば反映する
  if(route.split && route.split.length && route.split.some(s => effectiveSplitRate(s) !== s.rate)){
    const sum = route.split.reduce((a, s) => a + effectiveSplitRate(s), 0);
    return String(route.total || "").replace(/[\d.]+%/, `${sum.toFixed(1)}%`);
  }
  return route.total;
}

// ========== チャージルート：起点カード／ゴール決済方法タブ ==========
// 「起点にするカードを選ぶ」ことと「ゴールにする決済方法で絞り込む」ことは
// 目的が違うので、タブで分けて片方ずつ見せる。選んだ内容はタブを切り替えても保持される。
function initRouteFilterTabs(){
  const tabs = document.getElementById("routeFilterTabs");
  if(!tabs || tabs.dataset.bound) return;
  tabs.dataset.bound = "1";
  tabs.querySelectorAll(".route-filter-tab").forEach(btn => {
    btn.addEventListener("click", ()=>{
      const key = btn.dataset.routeTab;
      tabs.querySelectorAll(".route-filter-tab").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".route-filter-panel").forEach(p =>
        p.classList.toggle("active", p.dataset.routePanel === key));
    });
  });
}

function renderRoutes(){
  initRouteFilterTabs();
  renderRouteChips();
  const sb = document.getElementById("starterBox");
  if(sb){
    sb.innerHTML = starterPickerHtml();

    // リスト形式（プルダウン）
    document.getElementById("starterSel")?.addEventListener("change", (e)=>{
      starterIdx = parseInt(e.target.value, 10) || 0;
      renderRoutes();
    });
    document.getElementById("waypointSel")?.addEventListener("change", (e)=>{
      waypointName = e.target.value || null;
      destinationName = null; // 経由地を変えたら行き先の絞り込みはリセット
      renderRoutes();
    });
    document.getElementById("destinationSel")?.addEventListener("change", (e)=>{
      destinationName = e.target.value || null;
      renderRoutes();
    });

    // ボタン形式
    sb.querySelectorAll("[data-starter-idx]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        starterIdx = parseInt(btn.dataset.starterIdx, 10) || 0;
        renderRoutes();
      });
    });
    sb.querySelectorAll("[data-waypoint]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        waypointName = btn.dataset.waypoint || null;
        destinationName = null;
        renderRoutes();
      });
    });
    sb.querySelectorAll("[data-destination]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        destinationName = btn.dataset.destination || null;
        renderRoutes();
      });
    });

    // リスト／ボタンの表示切り替え
    sb.querySelectorAll("[data-picker-mode]").forEach(btn=>{
      btn.addEventListener("click", ()=> setPickerMode(btn.dataset.pickerMode));
    });
  }
  const list = document.getElementById("routeList");
  list.innerHTML = "";
  let shown = CHARGE_ROUTES.filter(r =>
    routeFilter === "all" || (r.pays || []).includes(routeFilter));

  // 経由地・行き先で絞り込み（「IDAREを経由するルートだけ見る」等）
  if(waypointName){
    shown = shown.filter(routeHasWaypoint);
    if(destinationName){
      shown = shown.filter(r => {
        const steps = r.steps || [];
        const idx = steps.indexOf(waypointName);
        return idx >= 0 && steps[idx + 1] === destinationName;
      });
    }
  }

  // 起点カードを選んでいるときは、そのカードで実行できるルートだけを、
  // そのカードでの還元率が高い順に並べる。
  const st0 = STARTER_CARDS[starterIdx];
  if(st0 && st0.rate !== null){
    const hidden = shown.filter(r => !routeWithStarter(r).usable);
    shown = shown.filter(r => routeWithStarter(r).usable);
    if(hidden.length){
      const note = document.createElement("div");
      note.className = "route-hidden-note";
      note.textContent = `${st0.name}では組めないルート${hidden.length}件を非表示にしています（${hidden.map(h=>h.name.split("（")[0].slice(0,18)).join("、")}）`;
      list.appendChild(note);
    }
  }
  shown.sort((a,b)=> routeSortValue(b) - routeSortValue(a));

  if(shown.length === 0){
    list.innerHTML = `<div class="store-empty-note">該当するルートがありません。</div>`;
    return;
  }
  shown.forEach((r, ri) => {
    const el = document.createElement("div");
    el.className = "route-card" + (ri === 0 ? " is-top" : "");
    el.dataset.routeName = r.name;
    // r.name はattribute値としても複数箇所で使うため、属性用に事前にエスケープしておく
    const rNameAttr = escapeAttr(r.name);
    const rNameHtml = escapeHtml(r.name);

    // ステップのアイコンSVGパス
    const STEP_ICONS = {
      "ANA Pay":       `<path d="m17.8 19.2 1-1-3.4-2.7-.1-4.1c0-1.4-.6-2.7-1.6-3.7L9.5 3.5a1 1 0 0 0-1.7.7v4.2L3.1 6.9a1 1 0 0 0-1.1.2l-.4.4a1 1 0 0 0 .1 1.5l4.1 3.2H2.4a1 1 0 0 0-.7 1.7l3.5 3.5c1 1 2.3 1.6 3.7 1.6l4.1.1 2.7 3.4 1-1-1-4Z"/>`,
      "楽天Edy":        `<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4"/><rect x="16" y="12" width="6" height="5" rx="1"/>`,
      "楽天キャッシュ":  `<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>`,
      "楽天ペイ":        `<path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 21v-6h6v6"/>`,
      "au PAY":         `<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>`,
      "Suica":          `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>`,
      "WAON":           `<circle cx="12" cy="9" r="4"/><path d="M9 12c-3 1-5 3-5 6h16c0-3-2-5-5-6"/>`,
      "ICOCA":          `<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/>`,
      "Revolut":        `<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a2.5 2.5 0 0 1 0 5H9m4 0 3 5"/>`,
      "V NEOBank":      `<path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/>`,
      "モバイルICOCA":  `<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/>`,
    };
    const DEFAULT_ICON = `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>`;

    // ルートのステップをチェーンビジュアルに変換
    const steps = r.steps || [];
    let chainHtml = "";
    steps.forEach((s, i) => {
      const label = withStarterName(s);
      const labelHtml = escapeHtml(label);
      const iconPath = Object.keys(STEP_ICONS).find(k => label.includes(k));
      const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${STEP_ICONS[iconPath] || DEFAULT_ICON}</svg>`;
      chainHtml += `<div class="route-chain-step"><div class="route-chain-icon">${svg}</div><div class="route-chain-label">${labelHtml}</div></div>`;
      if(i < steps.length - 1){
        chainHtml += `<div class="route-chain-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>`;
      }
    });

    // 合計還元率の数値を抽出
    const totalStr = routeTotalLabel(r);
    const totalMatch = totalStr.match(/(\d+(?:\.\d+)?)/);
    const totalNum = totalMatch ? totalMatch[1] : "—";

    // 金額ベースの獲得ポイント
    const gainSection = starterGainHtml(r);
    const gainsHtml = r.gains && r.gains.length ? `<ul class="route-gains">${r.gains.map(g=>`<li>${escapeHtml(g)}</li>`).join("")}</ul>` : "";

    el.innerHTML = `
      ${ri === 0 ? `<div class="route-top-badge">🏆 今いちばんお得なルート</div>` : ""}
      <div class="route-top">
        <span class="route-name">${rNameHtml}${verifyBadgeHtml("route:" + r.name)}</span>
        <button class="route-fav-btn${isRouteFav(r.name) ? " is-fav" : ""}" title="${isRouteFav(r.name) ? "お気に入りから外す" : "お気に入りに追加"}">
          <svg viewBox="0 0 24 24"><path d="M12 3.5l2.65 5.38 5.94.86-4.3 4.19 1.02 5.92L12 17.05l-5.31 2.8 1.02-5.92-4.3-4.19 5.94-.86L12 3.5z"/></svg>
        </button>
        <button class="icon-btn edit-route-btn" title="ルートを編集">✎</button>
        <button class="icon-btn delete-route-btn" title="ルートを削除">🗑</button>
      </div>
      ${r.shutdownWarn ? `<div class="route-shutdown-warn"><b>⚠️ 終了予定</b>　${escapeHtml(r.shutdownWarn.replace('⚠️ ', ''))}</div>` : ""}
      <div class="route-chain">${chainHtml}</div>
      <div class="route-rate-row">
        <span class="route-rate-row-label">合計還元率
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg>
        </span>
        <span class="route-rate-big">${totalNum}<span>%</span></span>
        <span class="route-rate-sub">${gainSection ? "" : escapeHtml(totalStr.replace(/[\d.]+%/, "").trim())}</span>
      </div>
      ${gainSection}
      ${gainsHtml}
      ${splitHtml(r)}
      ${r.starter ? `<div class="route-starter"><span class="route-starter-label">起点カード</span>${escapeHtml(r.starter)}</div>` : ""}
      ${howtoHtml(r, ri)}
      ${r.caution ? `<div class="route-caution">${escapeHtml(r.caution)}</div>` : ""}
      ${noteHtml(r.note)}
      ${sourceMetaHtml(r.note)}
      ${linkRowHtml(r.url, r.name, r.articleUrl, r.affKey, r.starters)}
      <button class="route-save-btn ${isRouteFav(r.name) ? 'saved' : ''}" data-route-save="${rNameAttr}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z"/></svg>
        ${isRouteFav(r.name) ? '保存済み ✓' : 'このルートを保存する'}
      </button>
    `;
    el.querySelector(".route-fav-btn")?.addEventListener("click", (e)=>{
      e.stopPropagation();
      toggleRouteFav(r.name);
    });
    el.querySelector("[data-route-save]")?.addEventListener("click", (e)=>{
      e.stopPropagation();
      toggleRouteFav(r.name);
      const btn = e.currentTarget;
      const saved = isRouteFav(r.name);
      btn.classList.toggle("saved", saved);
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z"/></svg>${saved ? "保存済み ✓" : "このルートを保存する"}`;
    });
    el.querySelector(".edit-route-btn")?.addEventListener("click", (e)=>{ e.stopPropagation(); openRouteModal(r); });
    el.querySelector(".delete-route-btn")?.addEventListener("click", (e)=>{
      e.stopPropagation();
      if(!confirm(`「${r.name}」を削除しますか？`)) return;
      const idx = CHARGE_ROUTES.indexOf(r);
      if(idx >= 0) CHARGE_ROUTES.splice(idx, 1);
      persistRoutes();
      renderRoutes();
    });
    list.appendChild(el);
  });

  list.querySelectorAll("[data-howto-toggle]").forEach(btn => {
    btn.addEventListener("click", ()=>{
      const box = list.querySelector(`[data-howto="${btn.dataset.howtoToggle}"]`);
      if(box) box.classList.toggle("collapsed");
    });
  });
}

// ========== リクエストフォームのURL ==========
// Googleフォームなどの投稿先。編集モードから設定でき、GitHub連携があれば
// affiliates.json と同じ仕組みで全員に共有される。
const REQUEST_URL_KEY = "kangenchou_request_url";

function loadRequestUrl(){
  try{ return localStorage.getItem(REQUEST_URL_KEY) || ""; } catch { return ""; }
}
let requestUrl = loadRequestUrl();

function applyRequestUrl(){
  const btn = document.getElementById("requestBtn");
  const box = document.querySelector(".request-box");
  if(!btn || !box) return;
  if(requestUrl){
    btn.href = requestUrl;
    box.style.display = "";
  } else {
    // 未設定なら導線ごと隠す（押しても何も起きないボタンは出さない）
    box.style.display = "none";
  }
}

document.getElementById("requestUrlBtn")?.addEventListener("click", ()=>{
  showModal("リクエスト先の設定",
    [{ key: "url", label: "GoogleフォームなどのURL（空欄にすると導線を隠します）", value: requestUrl }],
    (v)=>{
      requestUrl = v.url || "";
      try{ localStorage.setItem(REQUEST_URL_KEY, requestUrl); } catch {}
      applyRequestUrl();
    });
});

applyRequestUrl();

// ========== 近くの駅・路線を調べる ==========
// クレカ乗車の対応事業者は全国に約190あり、全部並べても自分に関係ないものばかり。
// 位置情報から周辺の駅を拾い、実際に使う路線だけを見せる。
// 座標はOpenStreetMapへの検索にのみ送られ、保存はしない。
const TOUCH_OPERATORS = [
  { key: /Osaka Metro|大阪市高速|大阪メトロ/i, name: "Osaka Metro", type: "private" },
  { key: /近鉄|近畿日本鉄道/, name: "近鉄", type: "private" },
  { key: /阪急/, name: "阪急電鉄", type: "private" },
  { key: /阪神/, name: "阪神電車", type: "private" },
  { key: /南海/, name: "南海電鉄", type: "private" },
  { key: /泉北高速/, name: "泉北高速鉄道", type: "private" },
  { key: /大阪モノレール/, name: "大阪モノレール", type: "private" },
  { key: /京阪/, name: "京阪電気鉄道", type: "private", note: "QRコード決済に対応（タッチ決済は要確認）" },
  { key: /神戸市営|神戸新交通|神戸電鉄|六甲/, name: "神戸エリア各線", type: "private" },
  { key: /京都丹後鉄道/, name: "京都丹後鉄道", type: "private" },
  { key: /東急|東京メトロ|都営|小田急|京王|西武|東武|京成|京急|相鉄/, name: "首都圏の私鉄・地下鉄", type: "private" },
  { key: /名鉄|名古屋市交通局/, name: "名鉄・名古屋市営", type: "private" },
  { key: /JR|旅客鉄道/, name: "JR各線", type: "jr" },
];

async function findNearbyLines(){
  const btn = document.getElementById("lineLocBtn");
  const out = document.getElementById("lineResult");
  if(!btn || !out) return;
  if(!("geolocation" in navigator)){
    out.textContent = "この端末は位置情報に対応していません。";
    return;
  }
  btn.disabled = true;
  out.textContent = "現在地を確認中…";

  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const { latitude, longitude } = pos.coords;
    out.textContent = "近くの駅を調べています…";
    try{
      const query = `
        [out:json][timeout:15];
        (
          node(around:2000,${latitude},${longitude})["railway"="station"];
        );
        out center;`;
      const data = await queryOverpassWithFallback(query);

      const found = new Map();
      (data.elements || []).forEach(el => {
        const t = el.tags || {};
        const text = [t.name, t.operator, t["operator:ja"], t.network].filter(Boolean).join(" ");
        if(!text || el.lat == null) return;
        const dist = haversineMeters(latitude, longitude, el.lat, el.lon);
        TOUCH_OPERATORS.forEach(op => {
          if(!op.key.test(text)) return;
          const prev = found.get(op.name);
          if(!prev || dist < prev.dist) found.set(op.name, { op, station: t.name || "", dist });
        });
      });

      if(found.size === 0){
        out.innerHTML = `<div class="line-empty">半径2km以内に、対応を確認できた路線が見つかりませんでした。</div>`;
        return;
      }
      const list = [...found.values()].sort((a,b)=> a.dist - b.dist);
      // 路線の種別に対応する店舗データを引いて、実際に使える決済を出す
      const pickStore = type => STORES.find(s => s.category === "交通" &&
        (type === "jr" ? s.name.startsWith("JR") : s.name.startsWith("私鉄")));

      out.innerHTML = list.map(x => {
        const sd = pickStore(x.op.type);
        const cards = sd ? [...combinedCards(sd)].sort((a,b)=> rateValue(b) - rateValue(a)).slice(0, 3) : [];
        return `
        <div class="line-item-wrap">
          <div class="line-item">
            <span class="line-dist">${Math.round(x.dist)}m</span>
            <div class="line-body">
              <div class="line-name">${x.op.name}</div>
              <div class="line-note">${x.station ? x.station + "　" : ""}${x.op.note || (x.op.type === "jr" ? "クレカ乗車は対象外。ICOCA・Suicaへのチャージで還元を取ります" : "クレカのタッチ決済で乗車できます")}</div>
            </div>
          </div>
          ${cards.length ? `<div class="line-cards">${cards.map((c,i)=>`
            <div class="line-card${i===0?" is-top":""}">
              <span class="line-card-rate">${displayRate(c)}</span>
              <span class="line-card-name">${c.name}</span>
            </div>`).join("")}</div>` : ""}
        </div>`;
      }).join("");
    } catch(err){
      out.textContent = `検索に失敗しました：${err.message || err}`;
    } finally {
      btn.disabled = false;
    }
  }, (err)=>{
    btn.disabled = false;
    out.textContent = err.code === err.PERMISSION_DENIED
      ? "位置情報が許可されませんでした。" : "位置情報を取得できませんでした。";
  }, { enableHighAccuracy: true, timeout: 10000 });
}

document.getElementById("lineLocBtn")?.addEventListener("click", findNearbyLines);

// ========== 現在地から店を特定して「今すぐ払う」に反映 ==========
// 位置情報は端末内で使い、OpenStreetMapへの周辺検索にのみ送る。
// このサイト自身はサーバーを持たないため、座標が手元に残ることはない。
async function locateForAnswer(){
  const btn = document.getElementById("answerLocBtn");
  const st = document.getElementById("answerLocStatus");
  if(!st) return;
  if(!("geolocation" in navigator)){
    st.textContent = "この端末は位置情報に対応していません。";
    return;
  }
  if(btn) btn.disabled = true;
  st.textContent = "現在地を確認中…";

  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const { latitude, longitude, accuracy } = pos.coords;
    // 商業施設の中では衛星が届かず、Wi-Fi/基地局測位になって誤差が数百mに広がる。
    // GPSの誤差(accuracy)に応じて検索半径を広げないと、目の前の店すら拾えない。
    // 屋内は誤差が大きいが、広げすぎると遠くの店を拾うので上限は控えめにする
    const radius = Math.min(900, Math.max(350, Math.round((accuracy || 0) * 1.5 + 250)));
    st.textContent = `近くのお店を探しています…（測位誤差 約${Math.round(accuracy || 0)}m）`;
    try{
      const query = buildOverpassQuery(latitude, longitude, radius, searchableStoreNames());
      const data = await queryOverpassWithFallback(query);

      const found = [];
      (data.elements || []).forEach(el => {
        const t = el.tags || {};
        // 商業施設内のテナントは name より brand / operator にしか名前が無いことがある
        const tag = [t.name, t["name:ja"], t.brand, t["brand:ja"], t.operator].filter(Boolean).join(" ");
        if(!tag) return;
        const sd = findStoreDataByName(tag);
        if(!sd) return;
        const lat = el.lat ?? (el.center && el.center.lat);
        const lon = el.lon ?? (el.center && el.center.lon);
        if(lat == null || lon == null) return;
        const dist = haversineMeters(latitude, longitude, lat, lon);
        if(!found.some(f => f.store.name === sd.name && Math.abs(f.dist - dist) < 30)){
          found.push({ store: sd, dist });
        }
      });
      found.sort((a,b)=> a.dist - b.dist);

      if(!found.length){
        document.getElementById("answerStore").value = "";
        st.textContent = `半径${radius}m以内に登録済みのお店が見つかりませんでした。お店を手動で選ぶか、「その他のお店」を選んでください。`;
        renderAnswer();
        return;
      }

      // 一番近い店を選びつつ、候補が複数あれば選び直せるようにする。
      // 商業施設内では複数店が同じくらいの距離に並ぶため、決め打ちだと外れる。
      const best = found[0];
      document.getElementById("answerStore").value = best.store.name;
      renderAnswer();

      const others = found.slice(1, 5);
      st.innerHTML = `${best.store.name}（約${Math.round(best.dist)}m）を選びました`
        + (others.length ? `<div class="loc-alts">近くの候補：${others.map(o =>
            `<button class="loc-alt" data-store="${escapeAttr(o.store.name)}">${o.store.name} ${Math.round(o.dist)}m</button>`
          ).join("")}</div>` : "");

      st.querySelectorAll(".loc-alt").forEach(b => {
        b.addEventListener("click", ()=>{
          document.getElementById("answerStore").value = b.dataset.store;
          renderAnswer();
        });
      });
    } catch(err){
      st.innerHTML = `地図サーバーが混み合っています。少し待ってからもう一度お試しください。`
        + `<div class="err-detail"><details><summary>詳細</summary>${escapeHtml(String(err.message || err))}</details></div>`;
    } finally {
      if(btn) btn.disabled = false;
    }
  }, (err)=>{
    if(btn) btn.disabled = false;
    st.textContent = err.code === err.PERMISSION_DENIED
      ? "位置情報が許可されませんでした。お店は手動でも選べます。"
      : "位置情報を取得できませんでした（建物の中では取得しにくいことがあります）。お店は手動でも選べます。";
  // 屋内では高精度測位を待つと失敗しやすいので、待ち時間を長めにし、
  // 直前の測位結果(最大1分)も使えるようにする
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
}

document.getElementById("answerLocBtn").addEventListener("click", locateForAnswer);

function openPrivacyModal(){ document.getElementById("privacyBtn").click(); }

// 位置情報の扱いを説明する。事実だけを書き、安心させる言い方はしない。
document.getElementById("privacyBtn").addEventListener("click", ()=>{
  const overlay = document.getElementById("modalOverlay");
  document.getElementById("modalBox").innerHTML = `
    <div class="modal-title">位置情報の扱いについて</div>
    <div class="privacy-body">
      <p><b>このサイトは位置情報を保存しません。</b>そもそもサーバーを持たない作りなので、送信先も保存先も存在しません。</p>

      <p class="privacy-h">実際に何が起きるか</p>
      <ol>
        <li>📍を押したときだけ、ブラウザが現在地を取得します（押さなければ一切取得しません）</li>
        <li>その座標は<b>OpenStreetMap</b>という地図サービスに送られ、「この地点の半径400m以内にある店」を検索します</li>
        <li>返ってきた店名と、このアプリの登録データを突き合わせて、一番近い店を選びます</li>
        <li>座標は画面を閉じた時点で消えます。記録も送信もしません</li>
      </ol>

      <p class="privacy-h">OpenStreetMapには座標が渡ります</p>
      <p>周辺検索のため、これは避けられません。OpenStreetMapは世界中で使われている非営利の地図プロジェクトですが、「どこにも一切渡らない」わけではない点は正直にお伝えします。気になる場合は、📍を使わずお店を手動で選んでください。機能は変わりません。</p>

      <p class="privacy-h">許可は後から取り消せます</p>
      <p>ブラウザの設定からこのサイトの位置情報アクセスをいつでも解除できます。アプリを閉じている間に位置を追跡することはありません（Webサイトには技術的にできません）。</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn save" id="privacyCloseBtn">閉じる</button>
    </div>
  `;
  overlay.style.display = "flex";
  document.getElementById("privacyCloseBtn").addEventListener("click", ()=>{ overlay.style.display = "none"; });
});

document.getElementById("privacyBtn2")?.addEventListener("click", openPrivacyModal);

// ========== 表示テーマ（ダーク / ライト） ==========
// 初回は端末のOS設定に従い、以降は選んだテーマを記憶する。
const THEME_KEY = "kangenchou_theme";

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeIcon").textContent = theme === "dark" ? "☾" : "☀";
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", theme === "dark" ? "#0B1120" : "#FFFFFF");
}

function initTheme(){
  let saved = null;
  try{ saved = localStorage.getItem(THEME_KEY); } catch {}
  const prefersLight = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(saved || (prefersLight ? "light" : "dark"));
}

document.getElementById("themeBtn").addEventListener("click", ()=>{
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  try{ localStorage.setItem(THEME_KEY, next); } catch {}
});

// ========== 文字サイズ切り替え ==========
const FONTSIZE_KEY = "kangenchou_fontsize";
const fontSizeBtn = document.getElementById("fontSizeBtn");

function applyFontSize(large){
  document.body.classList.toggle("large-text", large);
  document.documentElement.setAttribute("data-text-size", large ? "large" : "normal");
  fontSizeBtn.innerHTML = large ? '<span aria-hidden="true">A-</span>' : '<span aria-hidden="true">A+</span>';
  fontSizeBtn.setAttribute("aria-pressed", large ? "true" : "false");
  fontSizeBtn.title = large ? "文字サイズを戻す" : "文字を大きくする";
}

(()=>{
  let saved = null;
  try{ saved = localStorage.getItem(FONTSIZE_KEY); } catch {}
  applyFontSize(saved === "large");
})();

fontSizeBtn.addEventListener("click", ()=>{
  const next = !document.body.classList.contains("large-text");
  applyFontSize(next);
  try{ localStorage.setItem(FONTSIZE_KEY, next ? "large" : "normal"); } catch {}
});

// ========== 保有カード・お気に入り・金額 ==========
const WALLET_KEY = "kangenchou_wallet";
const FAV_KEY    = "kangenchou_favs";
const ROUTE_FAV_KEY = "kangenchou_route_favs";

// 選択肢として出す決済手段。データ中のカード名と部分一致で照合する。
// WALLET_OPTIONS_BASE：チャージルートに依存しない、汎用カードの手動リスト。
// WALLET_OPTIONS：実際に画面で使う一覧。BASE ＋ CHARGE_ROUTES から自動収集した
// 決済名をマージしたもの。チャージルートを追加・編集するだけで、ここにも
// 自動で反映されるようにするため（refreshWalletOptions() を参照）。
const WALLET_OPTIONS_BASE = [
  // 汎用の高還元カード
  "三井住友カード / Olive", "三井住友カード ゴールド（NL）",
  "三菱UFJカード", "JCBオリジナルシリーズ", "JCB CARD W", "JCBゴールド",
  "dカード", "リクルートカード", "セゾンゴールドプレミアム", "セゾンパール・アメックス",
  "JQセゾン(JCB)", "エポスGカード",
  // 店舗系カード
  "イオンカード", "セブンカード・プラス", "ビックカメラSuicaカード", "ローソンPontaプラス", "OPクレジットカード",
  "コスモ・ザ・カード・オーパス",
  // 交通系
  "J-WESTカード", "ビューカード", "Wesmo!",
  // デビットカード
  "V NEOBANKデビット", "カテエネBANKデビット", "デビットカード Point＋", "第一生命NEOBANKデビット Premium",
  // スマホ決済・共通ポイント
  "楽天カード", "PayPay", "PayPayカード ゴールド",
  "楽天ペイ", "d払い", "auPAY", "FamiPay", "AEON Pay",
  // チャージルート関連（残高・経由地）
  "IDARE", "ワンバンク", "nanaco", "スマホプリペイド", "バニラVISA（Visa eギフト）",
  "JAL Pay", "ANA Pay", "楽天Edy", "楽天キャッシュ", "モバイルSuica", "Kyash", "バンドルカード",
];

// steps・starters に混ざる「まだ起点カードを選んでいない」ときのプレースホルダー的な
// 表記や、カード名ではない出口（ギフト券など）、既存表記と重複するバリエーションは、
// 選択肢に出すと紛らわしい・ノイズになるため除外する。
const WALLET_OPTIONS_EXCLUDE = new Set([
  "高還元クレカ", "クレカ", "対象クレカ", "起点カード", "指定なし（基準）",
  "対象クレカ/デビット", "Visa/Mastercardのクレカ", "ANA Pay / Suica 等",
  "Amazonギフト券（Eメールタイプ）",
  "楽天Pay（チャージ払い）", // 「楽天ペイ」の別表記（重複）
  "VポイントPay（Visaタッチ）", // 「VポイントPay」の別表記（重複）
  "ソフトバンクカード（LINEMO以外は店頭申込のみ・新規不可）", // 注意書きがラベル化してしまっている
]);
// 「お店で〜支払い」「〜で利用」のような、決済名ではなく行動の説明になっているstepsも除外する。
function isDescriptiveStep(s){
  return /^お店で|支払い$|決済$|で支払う$|で利用$/.test(s);
}

// 「持っているカード」画面（オンボーディング・walletBtn）専用の除外リスト。
// チャージルートの経由地・ギフト券（バニラVISAなど、都度買って使うもので「持っている」ものではない）や、
// ブランド違いだけの重複表記（三井住友カードは既に「三井住友カード / Olive」等で選べるため二重）は、
// 「持っているカード」の選択肢としては不自然・紛らわしいので表示だけ除外する。
// （店舗にカードを追加するときの入力補助 WALLET_OPTIONS には、経由ルートの表記も含めて
// 　引き続きすべて残す。そちらは経由ルート自体を「対応決済」として登録したい場面があるため。）
const WALLET_DISPLAY_EXCLUDE = new Set([
  "IDARE", "ワンバンク", "nanaco", "スマホプリペイド", "バニラVISA（Visa eギフト）",
  "JAL Pay", "ANA Pay", "楽天Edy", "楽天キャッシュ", "モバイルSuica", "Kyash", "バンドルカード",
  "Mastercardの三井住友カード",
]);

let WALLET_OPTIONS = [...WALLET_OPTIONS_BASE];
let WALLET_OPTIONS_DISPLAY = WALLET_OPTIONS.filter(o => !WALLET_DISPLAY_EXCLUDE.has(o));

// 初回オンボーディングで最初に見せる「よく使われるカード」の厳選リスト。
// ここに無いものが消えるわけではなく、オンボーディング画面の「もっと見る」や、
// 後から使う「持っているカード・決済」設定（walletBtn）では引き続き全カードから選べる。
// 初回にいきなり60件近く並ぶと選ぶ気が失せるため、まず代表的なものだけに絞って
// 心理的ハードルを下げる狙い。
const WALLET_OPTIONS_FEATURED = [
  "三井住友カード / Olive", "三井住友カード ゴールド（NL）", "三菱UFJカード",
  "JCB CARD W", "dカード", "楽天カード",
  "PayPay", "PayPayカード ゴールド", "楽天ペイ", "d払い", "auPAY",
  "イオンカード", "セブンカード・プラス", "ビックカメラSuicaカード",
];

// CHARGE_ROUTESの内容（starters・steps）から決済名を自動収集し、
// WALLET_OPTIONS_BASEに無いものだけ末尾に追加する。
// チャージルートを追加・編集してこの関数を呼べば、都度「お店から選ぶ」側の
// 選択肢にも自動反映される（二重管理が不要になる）。
function refreshWalletOptions(){
  const known = new Set(WALLET_OPTIONS_BASE);
  const extra = [];
  (CHARGE_ROUTES || []).forEach(r => {
    if(r.starters){
      Object.keys(r.starters).forEach(name => {
        if(!known.has(name) && !WALLET_OPTIONS_EXCLUDE.has(name)){
          known.add(name); extra.push(name);
        }
      });
    }
    (r.steps || []).forEach(step => {
      if(known.has(step) || WALLET_OPTIONS_EXCLUDE.has(step)) return;
      if(isDescriptiveStep(step)) return;
      known.add(step); extra.push(step);
    });
  });
  WALLET_OPTIONS = [...WALLET_OPTIONS_BASE, ...extra];
  WALLET_OPTIONS_DISPLAY = WALLET_OPTIONS.filter(o => !WALLET_DISPLAY_EXCLUDE.has(o));
}
// 初回読み込み時点のCHARGE_ROUTESで一覧を組み立てる
// （CHARGE_ROUTES自体はこれより前の行ですでに読み込み済み）。
refreshWalletOptions();

function loadSet(key){
  try{
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch { return null; }
}
function saveSet(key, set){
  try{ localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

// null = 未設定（＝全部表示）。空Setとは意味が違うので区別する。
let wallet = loadSet(WALLET_KEY);
let favs   = loadSet(FAV_KEY) || new Set();
let routeFavs = loadSet(ROUTE_FAV_KEY) || new Set();
let amount = 0;

// ========== 目視確認チェック（編集モード限定） ==========
// ルート・積立プラン・カード等の項目を、運営者が実際に確認したかどうかをローカル保存。
// 保存はブラウザローカルのみ（GitHubには反映しない）。
// キー命名: "route:<name>", "invest:<broker>|<card>", "cardpick:<name>", "store:<name>"
const VERIFIED_KEY = "kangenchou_verified";
let verifiedSet = loadSet(VERIFIED_KEY) || new Set();

function isVerified(key){ return verifiedSet.has(key); }
function toggleVerified(key){
  if(verifiedSet.has(key)) verifiedSet.delete(key);
  else verifiedSet.add(key);
  saveSet(VERIFIED_KEY, verifiedSet);
}
// 確認済みバッジ／編集モード時のチェックボックスHTML
function verifyBadgeHtml(key){
  const on = isVerified(key);
  return `<button type="button" class="verify-badge${on ? " verified" : ""}" data-verify-key="${escapeAttr(key)}" title="目視確認済み">${on ? "✓ 確認済" : "○ 未確認"}</button>`;
}
// 確認状態はDOMだけをその場で更新。大きな一覧を再描画しないので軽快に切り替わる。
document.addEventListener("click", (e)=>{
  const el = e.target.closest("[data-verify-key]");
  if(!el || !editMode) return;
  e.preventDefault();
  e.stopPropagation();
  const key = el.dataset.verifyKey;
  toggleVerified(key);
  const on = isVerified(key);
  el.textContent = on ? "✓ 確認済" : "○ 未確認";
  el.classList.toggle("verified", on);
});

// カード名の包含関係。上位カテゴリのエントリーも「自分のカード」として扱う。
// 例：JCB CARD W を持っている人は「JCBオリジナルシリーズ」の特典も受けられる。
const CARD_ALIASES = {
  "JCB CARD W": ["JCBオリジナルシリーズ"],
  "JCBゴールド": ["JCBオリジナルシリーズ"],
  "三井住友カード ゴールド（NL）": ["三井住友カード / Olive"],
  "PayPayカード ゴールド": ["PayPay"],
};

function cardMatches(cardName, walletItem){
  if(cardName.includes(walletItem)) return true;
  if(walletItem.includes(cardName.split("（")[0])) return true;
  const aliases = CARD_ALIASES[walletItem] || [];
  return aliases.some(a => cardName.includes(a));
}

function ownsCard(cardName){
  if(!wallet || wallet.size === 0) return true; // 未設定なら全部表示
  return [...wallet].some(w => cardMatches(cardName, w));
}

// 会計金額を入れているとき、その還元率で何円戻るかを概算する
function yenBack(card){
  if(!amount) return null;
  const v = rateValue(card);
  if(!v) return null;
  return Math.floor(amount * v / 100);
}

function isFav(storeName){ return favs.has(storeName); }
function toggleFav(storeName){
  if(favs.has(storeName)) favs.delete(storeName); else favs.add(storeName);
  saveSet(FAV_KEY, favs);
  renderStores();
}

function isRouteFav(routeName){ return routeFavs.has(routeName); }
function toggleRouteFav(routeName){
  if(routeFavs.has(routeName)) routeFavs.delete(routeName); else routeFavs.add(routeName);
  saveSet(ROUTE_FAV_KEY, routeFavs);
  renderRoutes();
}


// ========== AIでキャンペーンを取り込む ==========
// キャンペーンページのURL（または説明文）を渡すと、中継サーバー（Cloudflare Workers）が
// 無料のGoogle Gemini APIを使って内容を読み取り、このアプリのデータ形式に整えて返す。
// ページの取得（URLフェッチ）もCORSに阻まれるため中継サーバー側で行っている。
// 反映前に必ずプレビューを挟み、人が確認してから保存する。
// プロンプト組み立てとAI呼び出しは cloudflare-worker/worker.js 側に集約している
// （フロント側はどのAIプロバイダを使っているか気にしなくていい設計）。

async function runAiImport(input, statusEl, previewEl, saveBtn){
  statusEl.className = "ai-status";
  statusEl.innerHTML = `<span class="ai-spinner"></span>公式ページを調べています…`;
  previewEl.innerHTML = "";
  saveBtn.style.display = "none";

  if(!window.AI_IMPORT_ENDPOINT){
    statusEl.className = "ai-status err";
    statusEl.textContent = "この機能を使うには中継サーバーの設定が必要です。scripts/app.js 冒頭の AI_IMPORT_ENDPOINT にデプロイ済みのURLを設定してください（cloudflare-worker/README.md 参照）。";
    return;
  }

  // Worker側で編集モードのパスワードを検証してもらうため、毎回パスワードを取得して送る。
  // （画面上のボタンを隠しているだけでは、開発者ツールから直接この関数を呼べてしまい
  //   認証にならないため。）
  const editorPassword = await ensureAiImportSecret();
  if(editorPassword === null){
    statusEl.className = "ai-status err";
    statusEl.textContent = "認証できなかったため中止しました。";
    return;
  }

  try{
    const res = await fetch(window.AI_IMPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        categories: CATEGORY_LIST,
        storeNames: STORES.map(s=>s.name),
        password: editorPassword
      })
    });
    const data = await res.json().catch(()=>null);
    if(!res.ok || !data || data.error){
      throw new Error((data && data.error && data.error.message) || `中継サーバーがエラーを返しました（HTTP ${res.status}）`);
    }

    const r = data;
    if(!r.store || !r.card){
      throw new Error("店舗名または決済手段を特定できませんでした。店名を明記して、もう一度お試しください。");
    }

    const conf = { high: "確度: 高", medium: "確度: 中", low: "確度: 低" }[r.confidence] || "";
    statusEl.textContent = `読み取りました（${conf}）。内容を確認して保存してください。`;

    // r.* は「AIが第三者ページの本文を読んで生成した値」であり、信頼できない外部由来の文字列として扱う。
    // 本文にプロンプトインジェクションが仕込まれていた場合、AIがHTML/scriptを含む文字列を返す可能性が
    // あるため、innerHTMLに入れる前に必ずエスケープする（URLはスキームも検証する）。
    const row = (k, v) => v
      ? `<div class="ai-preview-row"><div class="ai-preview-key">${escapeHtml(k)}</div><div class="ai-preview-val">${escapeHtml(v)}</div></div>`
      : "";
    const safeUrl = isSafeHttpUrl(r.url) ? r.url : "";
    // 抽出元ページとurlのドメインが一致しない場合、Worker側でr.domainMismatch=trueが
    // 返ってくる。一般の「⚠ 注意」欄に埋もれさせず、目立つ専用バナーとして出す。
    const domainMismatchBanner = r.domainMismatch
      ? `<div class="ai-preview-domain-alert" style="background:#fee2e2;border:2px solid #dc2626;color:#991b1b;padding:10px 12px;border-radius:8px;margin-bottom:8px;font-weight:700;">
          🚨 抽出元ページと出典URLのドメインが違います。フィッシングサイト等が混入している可能性があるため、リンク先を必ず開いて公式サイトか確認してから保存してください。
        </div>`
      : "";
    previewEl.innerHTML = `
      ${domainMismatchBanner}
      <h4>${escapeHtml(r.store || "（店舗名なし）")}</h4>
      ${row("カテゴリ", r.category)}
      ${row("決済手段", r.card)}
      ${row("還元率", r.rate)}
      ${row("支払い方法", r.method)}
      ${row("終了日", r.expires || "常設（終了日なし）")}
      ${row("補足", r.note)}
      ${row("出典", safeUrl ? `<a class="src-link" href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">公式 ↗</a>` : (r.url ? "（出典URLの形式が不正なため非表示にしました）" : ""))}
      ${r.warning ? row("⚠ 注意", r.warning) : ""}
    `;

    saveBtn.style.display = "block";
    saveBtn.onclick = ()=>{
      const cat = CATEGORY_LIST.includes(r.category) ? r.category : "その他";
      let store = STORES.find(s => s.name === r.store);
      if(!store){
        store = { name: r.store, category: cat, cards: [] };
        STORES.push(store);
      }
      const card = {
        name: r.card, rate: r.rate, method: r.method, note: r.note,
        // 保存時点でもURLのスキームを検証しておく（http/https以外・不正な値は保存しない）。
        // 表示側のエスケープと合わせた二重の防御。
        url: isSafeHttpUrl(r.url) ? r.url : undefined,
        expires: (r.expires && r.expires !== "null") ? r.expires : undefined
      };
      const idx = store.cards.findIndex(c => c.name === r.card);
      if(idx >= 0) store.cards[idx] = card; else store.cards.push(card);

      persistStores();
      renderStores();
      renderCampaigns();
      document.getElementById("modalOverlay").style.display = "none";
    };

  } catch(err){
    statusEl.className = "ai-status err";
    statusEl.textContent = `読み取りに失敗しました：${err.message}\nURLを確認するか、店名とキャンペーン内容を文章で書いてもう一度お試しください。`;
    console.error(err);
  }
}

function openAiImportModal(){
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  box.innerHTML = `
    <div class="modal-title">リンクから取り込む</div>
    <div class="modal-field">
      <label>キャンペーンのURL、または内容の説明</label>
      <textarea class="ai-input" id="aiInput" placeholder="https://www.smbc-card.com/... &#10;または「セブンイレブンの8月のPayPayキャンペーン」のような説明でもOK"></textarea>
      <p class="ai-hint">公式ページを調べて、還元率・対象の支払い方法・終了日を読み取ります。保存前に内容を確認できます。</p>
    </div>
    <div id="aiStatus" class="ai-status" style="display:none;"></div>
    <div id="aiPreview"></div>
    <div class="modal-actions">
      <button class="modal-btn cancel" id="aiCancelBtn">閉じる</button>
      <button class="modal-btn save" id="aiRunBtn">調べる</button>
    </div>
    <button class="modal-btn save" id="aiSaveBtn" style="display:none;margin-top:9px;width:100%;">この内容で保存</button>
  `;
  overlay.style.display = "flex";

  const statusEl = document.getElementById("aiStatus");
  const previewEl = document.getElementById("aiPreview");
  const saveBtn = document.getElementById("aiSaveBtn");

  document.getElementById("aiCancelBtn").addEventListener("click", ()=>{ overlay.style.display = "none"; });
  document.getElementById("aiRunBtn").addEventListener("click", ()=>{
    const v = document.getElementById("aiInput").value.trim();
    if(!v){ alert("URLまたはキャンペーンの内容を入力してください"); return; }
    statusEl.style.display = "block";
    runAiImport(v, statusEl, previewEl, saveBtn);
  });
}
document.getElementById("aiImportBtn").addEventListener("click", openAiImportModal);
document.getElementById("aiImportBtnCampaigns")?.addEventListener("click", openAiImportModal);

// --- 紹介リンクの管理画面 ---
// 旧: モーダルでカードごとのアフィリンクを1件ずつ設定していたが、
// admin/affiliates.html に一覧管理ページを作ったため、affiliateBtn は
// そちらへの直接リンクに変更した（index.html側でhref設定済み、JSでの処理は不要）。

// --- 保有カード設定 ---
function updateWalletSummary(){
  const el = document.getElementById("walletSummary");
  const btn = document.getElementById("walletBtn");
  if(!wallet || wallet.size === 0){
    el.textContent = "タップして選ぶ";
    btn.classList.add("unset");   // 未設定は目立たせて設定を促す
    return;
  }
  btn.classList.remove("unset");
  const arr = [...wallet];
  el.textContent = arr.length <= 2 ? arr.join("、") : `${arr[0]} ほか${arr.length - 1}件`;
}

document.getElementById("walletBtn").addEventListener("click", ()=>{
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  const cur = wallet || new Set();
  box.innerHTML = `
    <div class="modal-title">持っているカード・決済</div>
    <p class="ai-hint" style="margin:-8px 0 14px;">選ぶと、その決済だけに絞って比較します。何も選ばなければ全部表示します。</p>
    <div class="wallet-grid">
      ${WALLET_OPTIONS_DISPLAY.map(o => `<button class="wallet-opt${cur.has(o) ? " on" : ""}" data-opt="${o}">${o}</button>`).join("")}
    </div>
    <div class="modal-actions">
      <button class="modal-btn cancel" id="walletClearBtn">すべて解除</button>
      <button class="modal-btn save" id="walletSaveBtn">保存</button>
    </div>
  `;
  overlay.style.display = "flex";

  const picked = new Set(cur);
  box.querySelectorAll(".wallet-opt").forEach(b => {
    b.addEventListener("click", ()=>{
      const o = b.dataset.opt;
      if(picked.has(o)){ picked.delete(o); b.classList.remove("on"); }
      else { picked.add(o); b.classList.add("on"); }
    });
  });
  document.getElementById("walletClearBtn").addEventListener("click", ()=>{
    picked.clear();
    box.querySelectorAll(".wallet-opt").forEach(b => b.classList.remove("on"));
  });
  document.getElementById("walletSaveBtn").addEventListener("click", ()=>{
    wallet = picked.size ? picked : null;
    saveSet(WALLET_KEY, picked);
    updateWalletSummary();
    renderStores();
    renderMufg();
    overlay.style.display = "none";
  });
});

document.getElementById("amountInput").addEventListener("input", (e)=>{
  amount = Math.max(0, parseInt(e.target.value, 10) || 0);
  renderStores();
  renderAnswer();
});
document.getElementById("answerStore").addEventListener("change", renderAnswer);

// 楽天ペイ「提示との併用で1.5%」チェック。お店の順位・チャージルート両方に反映する。
const rpayChkEl = document.getElementById("rpayChk");
if(rpayChkEl){
  rpayChkEl.checked = rpayHigh;
  rpayChkEl.addEventListener("change", (e)=> setRpay(e.target.checked));
}

updateWalletSummary();

// --- 初回セットアップ ---
// カードが22種類あるため、未設定のまま使うと全部並んで読みにくい。
// そこで初回だけ保有カードの選択画面を出す。「あとで」を選んだ場合も
// 記録して、二度と邪魔しない。
const ONBOARD_KEY = "kangenchou_onboarded";

function showOnboarding(){
  const overlay = document.getElementById("onboardOverlay");
  const grid = document.getElementById("onboardGrid");
  const picked = new Set();

  function optBtn(o){
    return `<button class="wallet-opt" data-opt="${o}">${o}</button>`;
  }
  function bindOpt(b){
    b.addEventListener("click", ()=>{
      const o = b.dataset.opt;
      if(picked.has(o)){ picked.delete(o); b.classList.remove("on"); }
      else { picked.add(o); b.classList.add("on"); }
      document.getElementById("onboardDoneBtn").textContent =
        picked.size ? `${picked.size}枚で はじめる` : "はじめる";
    });
  }

  // 最初は「よく使われるカード」だけを表示し、選ぶ気が失せない枚数に絞る。
  // 全カードから選びたい人のために「もっと見る」で残りを追加表示する。
  const featured = WALLET_OPTIONS_FEATURED.filter(o => WALLET_OPTIONS_DISPLAY.includes(o));
  const rest = WALLET_OPTIONS_DISPLAY.filter(o => !featured.includes(o));

  grid.innerHTML = featured.map(optBtn).join("");
  grid.querySelectorAll(".wallet-opt").forEach(bindOpt);

  const moreWrap = document.getElementById("onboardMoreWrap");
  if(moreWrap){
    moreWrap.innerHTML = rest.length
      ? `<button type="button" class="onboard-more-btn" id="onboardMoreBtn">＋ 他のカードも見る（あと${rest.length}件）</button>`
      : "";
    const moreBtn = document.getElementById("onboardMoreBtn");
    if(moreBtn){
      moreBtn.addEventListener("click", ()=>{
        rest.forEach(o => grid.insertAdjacentHTML("beforeend", optBtn(o)));
        grid.querySelectorAll(".wallet-opt").forEach(b => {
          if(!b.dataset.bound){ b.dataset.bound = "1"; bindOpt(b); }
        });
        moreWrap.innerHTML = "";
      }, { once: true });
    }
  }

  const finish = (save)=>{
    if(save && picked.size){
      wallet = picked;
      saveSet(WALLET_KEY, picked);
      updateWalletSummary();
      renderStores();
      renderMufg();
    }
    try{ localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    overlay.style.display = "none";
  };

  document.getElementById("onboardDoneBtn").addEventListener("click", ()=> finish(true));
  document.getElementById("onboardSkipBtn").addEventListener("click", ()=> finish(false));
  overlay.style.display = "flex";
}

function maybeOnboard(){
  let done = null;
  try{ done = localStorage.getItem(ONBOARD_KEY); } catch {}
  // すでに保有カードを設定済みなら、初回画面は不要
  if(done || (wallet && wallet.size)) return;
  showOnboarding();
}

maybeOnboard();

initTheme();

document.getElementById("showExpiredChk").addEventListener("change", renderCampaigns);
document.getElementById("investAmount").addEventListener("input", renderInvest);
document.getElementById("routeAmount")?.addEventListener("input", renderRoutes);

renderTodayDeals();
renderEC();
renderPicks();
renderEntryChecks();
renderCampaigns();
// 段階制（tiers）があるものは階層ごとに計算し、無ければ一律の還元率で計算する
// クレカ積立の条件チェック状態を保存する。
// キーは "broker|card|condIndex" の組み合わせ。三菱UFJカード計算機と同じ仕組み。
const INVEST_COND_KEY = "kangenchou_invest_conds";
let investCondChecked = loadSet(INVEST_COND_KEY) || new Set();

function investCondKey(plan, i){ return `${plan.broker}|${plan.card}|${i}`; }

function investEffectiveRate(plan){
  if(!plan.conds || !plan.conds.length) return plan.rate;
  let r = plan.rate;
  plan.conds.forEach((c, i) => {
    if(investCondChecked.has(investCondKey(plan, i))) r += c.v;
  });
  return r;
}

function monthlyPoints(plan, monthly){
  const rate = investEffectiveRate(plan);
  if(!plan.tiers) return monthly * rate / 100;
  let remaining = monthly, prev = 0, pts = 0;
  for(const [cap, r] of plan.tiers){
    const band = Math.max(0, Math.min(remaining, cap - prev));
    pts += band * r / 100;
    remaining -= band;
    prev = cap;
    if(remaining <= 0) break;
  }
  return pts;
}

function renderCardPicks(){
  const list = document.getElementById("cardPickList");
  if(!list) return;
  list.innerHTML = "";
  CARD_PICKS.forEach(g => {
    const h = document.createElement("div");
    h.className = "picks-divider";
    h.dataset.group = g.group;
    h.innerHTML = `<span>${g.group}</span>`;
    list.appendChild(h);

    g.items.forEach(c => {
      const el = document.createElement("div");
      el.className = "route-card";
      const aff = affiliateFor(c.name);
      el.innerHTML = `
        <div class="route-top">
          <button class="card-pick-name-btn route-name" data-card="${c.name}">${c.name}</button>${verifyBadgeHtml("cardpick:" + c.name)}
          <span class="route-total">${c.rate}</span>
        </div>
        ${c.cardImageUrl ? `
        <a href="${c.cardImageLink || aff || c.url}" target="_blank" rel="sponsored noopener nofollow" class="cardpick-face-link">
          <img src="${c.cardImageUrl}" alt="${c.name} 券面" class="cardpick-face-img">
        </a>` : ""}
        ${c.affiliateBannerUrl ? `
        <a href="${c.affiliateBannerLink}" target="_blank" rel="sponsored noopener nofollow" style="display:block;margin:8px 0 4px;">
          <img src="${c.affiliateBannerUrl}" alt="${c.name} PR" style="display:block;width:100%;height:auto;border-radius:8px;">
        </a>` : ""}
        <div class="cardpick-fee">${c.fee}</div>
        <div class="cardpick-why">${c.why}</div>
        ${c.cons ? `<div class="cardpick-cons"><span class="cardpick-cons-label">注意点・デメリット</span>${c.cons}</div>` : ""}
        <div class="cardpick-good">こんな人に：${c.good}</div>
        ${noteHtml(c.detail)}
        ${CARD_ARTICLE_MAP[c.name] ? `<a href="${CARD_ARTICLE_MAP[c.name]}" class="card-article-btn" target="_blank" rel="noopener noreferrer">📖 くわしい記事を読む ↗</a>` : ""}
        ${sourceMetaHtml(c.detail)}
        ${freshnessHtml(c.detail)}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          <button class="featured-detail-btn" data-card="${c.name}" style="flex:1;">詳細＆申し込み</button>
          ${aff ? `<a class="featured-apply-btn" href="${aff}" target="_blank" rel="sponsored noopener noreferrer" style="flex:1;">申し込む ↗</a>` : ""}
        </div>
      `;
      el.querySelectorAll("[data-card]").forEach(btn => {
        if(btn.tagName !== "A") btn.addEventListener("click", ()=> openCardDetailModal(btn.dataset.card));
      });
      list.appendChild(el);
    });
  });
}

let investFilter = "all";

function renderInvestChips(){
  const row = document.getElementById("investChipRow");
  if(!row) return;
  const counts = {};
  INVEST_PLANS.forEach(p => counts[p.broker] = (counts[p.broker]||0)+1);

  row.innerHTML = "";
  const mk = (key, label, count) => {
    const b = document.createElement("button");
    b.className = "category-chip" + (investFilter === key ? " active" : "");
    b.innerHTML = `${label} <span class="chip-count">${count}</span>`;
    b.addEventListener("click", ()=>{ investFilter = key; renderInvest(); });
    row.appendChild(b);
  };
  mk("all", "すべて", INVEST_PLANS.length);
  Object.keys(counts).sort((a,b)=> counts[b]-counts[a]).forEach(b => mk(b, b, counts[b]));
}

function renderInvest(){
  renderInvestChips();
  const list = document.getElementById("investList");
  if(!list) return;
  const monthly = Math.max(0, parseInt(document.getElementById("investAmount").value, 10) || 0);

  // スクロール位置を保持する（条件チェックでDOMを再構築しても画面が飛ばないようにする）
  const scrollY = window.scrollY;

  list.innerHTML = "";

  const filtered = investFilter === "all" ? INVEST_PLANS : INVEST_PLANS.filter(p => p.broker === investFilter);
  // アフィリエイト案件（DMM株など）は特殊な還元形式のためソート対象から外し、非アフィリの通常プランの後ろに固定表示する
  const affiliatePlans = filtered.filter(p => p.isAffiliate);
  const regularPlans = filtered.filter(p => !p.isAffiliate);
  const sorted = [...regularPlans].sort((a,b) => monthlyPoints(b, monthly) - monthlyPoints(a, monthly));
  const displayList = [...sorted, ...affiliatePlans];

  displayList.forEach((p, i) => {
    const effectiveRate = investEffectiveRate(p);
    const mp = Math.floor(monthlyPoints(p, monthly));
    const yearly = mp * 12;
    const el = document.createElement("div");
    el.className = "route-card" + (i === 0 && !p.isAffiliate ? " is-top" : "") + (p.isAffiliate ? " affiliate-in-list" : "");

    const condsHtml = (p.conds && p.conds.length) ? `
      <div class="invest-conds">
        <div class="invest-conds-label">あなたの条件（チェックで還元率が変わります）</div>
        ${p.conds.map((c, ci) => {
          const k = investCondKey(p, ci);
          const on = investCondChecked.has(k);
          return `<label class="mufg-item${on ? " on" : ""}">
            <input type="checkbox" data-invest-cond="${k}" ${on ? "checked" : ""}>
            <span class="mufg-label">${c.label}${c.hint ? `<span class="mufg-hint">${c.hint}</span>` : ""}</span>
            <span class="mufg-v">+${c.v}%</span>
          </label>`;
        }).join("")}
        <div class="invest-conds-result">あなたの還元率：<b>${effectiveRate.toFixed(1)}%</b></div>
      </div>` : "";

    const isAff = p.isAffiliate;
    const affUrl = isAff ? (affiliateFor(p.broker) || p.directUrlFallback || null) : null;
    const resultBlock = isAff ? `
      <div class="invest-result">
        <div class="invest-result-item">
          <span class="invest-result-label">年会費</span>
          <span class="invest-result-val sub">${p.fee}</span>
        </div>
      </div>
    ` : `
      <div class="invest-result">
        <div class="invest-result-item">
          <span class="invest-result-label">毎月</span>
          <span class="invest-result-val">${mp.toLocaleString()} pt</span>
        </div>
        <div class="invest-result-item">
          <span class="invest-result-label">年間</span>
          <span class="invest-result-val big">${yearly.toLocaleString()} pt</span>
        </div>
        <div class="invest-result-item">
          <span class="invest-result-label">年会費</span>
          <span class="invest-result-val sub">${p.fee}</span>
        </div>
      </div>
    `;

    el.innerHTML = `
      ${isAff ? '<div class="affiliate-section-label" style="margin-bottom:6px;">📣 PR</div>' : ''}
      <div class="route-top">
        <span class="route-name">${p.broker}${p.card ? " × " + p.card : ""}${verifyBadgeHtml("invest:" + p.broker + "|" + (p.card || ""))}</span>
        <span class="route-total">${p.rateLabel}</span>
      </div>
      ${condsHtml}
      ${resultBlock}
      ${noteHtml(p.note)}
      ${isAff && affUrl ? `
        <div style="margin-top:10px;">
          <a href="${affUrl}" rel="sponsored nofollow noopener noreferrer" class="affiliate-dmm-btn">${p.broker}の口座開設ページを見る（PR）</a>
          ${p.trackingPixel ? `<img border="0" width="1" height="1" src="${p.trackingPixel}" alt="" style="position:absolute;visibility:hidden;">` : ''}
          ${p.lpHash ? `<a href="${p.lpHash}" class="affiliate-detail-link">${p.broker}の詳細ページを見る →</a>` : ''}
          <div class="lp-risk-note" style="margin-top:10px;">⚠️ 株式投資には元本割れのリスクがあります。（2026年8月13日時点）</div>
        </div>
      ` : linkRowHtml(p.url, p.card)}
    `;

    el.querySelectorAll("[data-invest-cond]").forEach(chk => {
      chk.addEventListener("change", ()=>{
        const k = chk.dataset.investCond;
        if(investCondChecked.has(k)) investCondChecked.delete(k);
        else investCondChecked.add(k);
        saveSet(INVEST_COND_KEY, investCondChecked);
        renderInvest();
      });
    });

    list.appendChild(el);
  });

  // DOMを再構築してもスクロール位置を維持する
  requestAnimationFrame(() => window.scrollTo(0, scrollY));
}

renderRoutes();
renderInvest();
renderCardPicks();
renderFeaturedCards();

// ---- カード選び診断（あなたはどのタイプ？） ----
// 2〜3問に答えると、カード・積立・チャージルートから2〜3件おすすめを出す。
// 個別データを重複して持たず、実在するCARD_PICKS/CHARGE_ROUTES/INVEST_PLANSから
// 名前で引いてくることで、還元率や注記が本体側の更新と自動で揃うようにしている。
function findCardPick(name){
  for(const g of CARD_PICKS){
    const item = g.items.find(i => i.name === name);
    if(item) return item;
  }
  return null;
}
function findRoute(name){
  return CHARGE_ROUTES.find(r => r.name === name) || null;
}
function findInvest(broker, card){
  return INVEST_PLANS.find(p => p.broker === broker && p.card === card) || null;
}

function diagPickHtml(pick){
  if(pick.kind === "card"){
    const c = findCardPick(pick.name);
    if(!c) return "";
    return `<div class="diag-pick">
      <div class="diag-pick-top"><span class="diag-pick-name">${c.name}</span><span class="diag-pick-rate">${c.rate}</span></div>
      <div class="diag-pick-reason">${pick.reason || c.why}</div>
      ${linkRowHtml(c.url, c.name)}
    </div>`;
  }
  if(pick.kind === "route"){
    const r = findRoute(pick.name);
    if(!r) return "";
    return `<div class="diag-pick">
      <div class="diag-pick-top"><span class="diag-pick-name">${r.name}</span><span class="diag-pick-rate">${r.total}</span></div>
      <div class="diag-pick-reason">${pick.reason || (r.starter || "")}</div>
      ${linkRowHtml(r.url, r.name, r.articleUrl, r.affKey, r.starters)}
    </div>`;
  }
  if(pick.kind === "invest"){
    const p = findInvest(pick.broker, pick.card);
    if(!p) return "";
    return `<div class="diag-pick">
      <div class="diag-pick-top"><span class="diag-pick-name">${p.broker} × ${p.card}</span><span class="diag-pick-rate">${p.rateLabel}</span></div>
      <div class="diag-pick-reason">${pick.reason || p.fee}</div>
      ${linkRowHtml(p.url, p.card)}
    </div>`;
  }
  return "";
}

const CARD_QUIZ = {
  start: "effort",
  nodes: {
    effort: {
      q: "めんどうな手順を踏んでまで、少しでも高い還元を追求したい？",
      options: [
        { label: "はい、手間をかけてもいい", next: "effortFee" },
        { label: "いいえ、シンプルに使いたい", next: "simpleAmount" }
      ]
    },
    effortFee: {
      q: "年会費を払ってでも、還元率をさらに上げたい？",
      options: [
        { label: "はい（年会費を払ってもいい）", next: "resultEffortFee" },
        { label: "いいえ（年会費は無料がいい）", next: "resultEffortFree" }
      ]
    },
    simpleAmount: {
      q: "年間のカード利用額は100万円を超えそう？",
      options: [
        { label: "超えそう", next: "resultSimpleGold" },
        { label: "超えなそう", next: "resultSimpleBase" }
      ]
    }
  },
  results: {
    resultEffortFee: {
      lead: "手間も年会費もかけていいなら、積立・チャージ両方で上位ランクを狙うのが向いています。",
      picks: [
        { kind: "invest", broker: "SBI証券", card: "三井住友カード プラチナプリファード",
          reason: "年会費33,000円だが、年500万円以上の利用でクレカ積立が3.0%になり、積立分だけで年会費を回収しやすい。" },
        { kind: "route", name: "V NEOBANKデビット → au PAY → VポイントPay",
          reason: "年会費・審査なしで組めるルートの中では還元率・上限額ともに優秀。カテエネBANKデビット（月末残高200万円で2.0%）を起点にすると合計3.0%になる。" }
      ]
    },
    resultEffortFree: {
      lead: "手間はかけてもいいけど年会費は避けたいなら、無料で組めるチャージルートが向いています。",
      picks: [
        { kind: "route", name: "V NEOBANKデビット → au PAY → VポイントPay",
          reason: "カテエネBANKデビット（月末残高200万円で2.0%）を起点に、月5万円まで3.0%を狙える。V NEOBANKは11月で終了するため、今から始めるならこちら。" },
        { kind: "route", name: "ANA Pay → 楽天Edy → 楽天キャッシュ → 楽天ペイ",
          reason: "回せる金額は月1万円までと小さいが、還元率は最高水準。カテエネBANKデビット（月末残高200万円で2.0%）やリクルートカード（1.2%）を起点にするとさらに上がる。" }
      ]
    },
    resultSimpleGold: {
      lead: "年100万円以上使うなら、年会費以上のメリットを回収しやすいゴールドクラスが向いています。",
      picks: [
        { kind: "card", name: "三井住友カード ゴールド（NL）",
          reason: "年100万円利用で翌年以降の年会費が永年無料になり、実質年会費なしで持てる。" },
        { kind: "invest", broker: "SBI証券", card: "三井住友カード ゴールド（NL）",
          reason: "同じカードでクレカ積立も1.0%になり、日常利用と積立を1枚にまとめられる。" }
      ]
    },
    resultSimpleBase: {
      lead: "シンプルに、年会費なしで基本還元率が高い1枚を持つのがおすすめです。",
      picks: [
        { kind: "card", name: "リクルートカード",
          reason: "特約店を気にせず、どこで使っても1.2%。年会費無料カードでは最高水準。" },
        { kind: "invest", broker: "マネックス証券", card: "dカード",
          reason: "同じ発行元のdカードなら、条件なし・年会費無料でクレカ積立も1.1%とバランスがよい。" }
      ]
    }
  }
};

let diagPath = [];

function renderDiagNode(){
  const body = document.getElementById("cardDiagBody");
  if(!body) return;
  const key = diagPath.length ? diagPath[diagPath.length - 1] : CARD_QUIZ.start;
  const node = CARD_QUIZ.nodes[key];

  if(node){
    // Update section subtitle with current question
    const titleEl = document.querySelector(".pt-section-title");
    if(titleEl) titleEl.textContent = "あなたはどのタイプ？";
    const subEl = document.querySelector(".pt-section-sub");
    if(subEl) subEl.textContent = node.q;

    const iconMap = {
      "はい、手間をかけてもいい": `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 9V5a3 3 0 00-6 0v4"/><path d="M18.8 22H5.2a2 2 0 01-2-1.8L2 9h20l-1.2 11.2a2 2 0 01-2 1.8z"/><path d="M8 14h.01M16 14h.01M12 18h.01"/></svg>`,
      "いいえ、シンプルに使いたい": `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      "はい（年会費を払ってもいい）": `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><text x="12" y="16" text-anchor="middle" font-size="12" fill="currentColor" stroke="none" font-weight="700">¥</text></svg>`,
      "いいえ（年会費は無料がいい）": `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
      "超えそう": `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      "超えなそう": `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="20" x2="12" y2="10"/><polyline points="18 14 12 20 6 14"/><line x1="4" y1="4" x2="20" y2="4"/></svg>`
    };
    const descMap = {
      "はい、手間をかけてもいい": "手間をかけてでも高還元を狙いたい人向け",
      "いいえ、シンプルに使いたい": "簡単に使えて安定した還元を重視したい人向け",
      "はい（年会費を払ってもいい）": "年会費を払ってでもさらに高い還元率を目指す",
      "いいえ（年会費は無料がいい）": "年会費無料で組めるルートを活用する",
      "超えそう": "ゴールドカードで年会費以上のメリットを回収",
      "超えなそう": "年会費無料で基本還元率の高い1枚"
    };

    body.innerHTML = `
      ${diagPath.length ? `<button class="diag-back-btn" id="diagBackBtn">← 一つ前に戻る</button>` : ""}
      ${node.options.map((o,i) => `<button class="pt-diag-option" data-next="${o.next}">
        <span class="pt-diag-option-icon">${iconMap[o.label] || '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/></svg>'}</span>
        <span class="pt-diag-option-text">
          <span class="pt-diag-option-label">${o.label}</span>
          <span class="pt-diag-option-desc">${descMap[o.label] || ""}</span>
        </span>
        <span class="pt-diag-option-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></span>
      </button>`).join("")}
    `;
    body.querySelector("#diagBackBtn")?.addEventListener("click", ()=>{
      diagPath.pop();
      renderDiagNode();
    });
    body.querySelectorAll(".pt-diag-option").forEach(btn => {
      btn.addEventListener("click", ()=>{
        diagPath.push(btn.dataset.next);
        renderDiagNode();
      });
    });
    return;
  }

  // 質問ノードでなければ結果
  const result = CARD_QUIZ.results[key];
  if(!result) return;
  body.innerHTML = `
    <button class="diag-back-btn" id="diagBackBtn">← 一つ前に戻る</button>
    <div class="diag-result-lead">${result.lead}</div>
    ${result.picks.map(diagPickHtml).join("")}
    <button class="diag-restart-btn" id="diagRestartBtn">はじめからやり直す</button>
  `;
  body.querySelector("#diagBackBtn").addEventListener("click", ()=>{
    diagPath.pop();
    renderDiagNode();
  });
  body.querySelector("#diagRestartBtn").addEventListener("click", ()=>{
    diagPath = [];
    renderDiagNode();
  });
}

renderDiagNode();

// ===== Hero Card & Features — populate from CARD_PICKS =====
(function(){
  const defaultCard = CARD_PICKS[0]?.items[0];
  if(!defaultCard) return;

  function updateHeroCard(card){
    const nameEl = document.getElementById("heroCardName");
    const rateEl = document.getElementById("heroCardRate");
    const descEl = document.getElementById("heroCardDesc");
    const baseEl = document.getElementById("heroBaseRate");
    const feeEl = document.getElementById("heroFee");
    const bonusEl = document.getElementById("heroBonus");

    if(nameEl) nameEl.textContent = card.name;

    // 提携中の券面画像があるカードは、カードアイコン部分をアフィリエイト券面画像に差し替える。
    const visualEl = document.getElementById("heroCardVisual");
    if(visualEl){
      if(card.cardImageUrl){
        const href = card.cardImageLink || affiliateFor(card.name) || card.url || "#";
        visualEl.innerHTML = `
          <a href="${href}" target="_blank" rel="sponsored noopener nofollow" class="pt-card-face-link" aria-label="${card.name}の券面を見る">
            <img src="${card.cardImageUrl}" alt="${card.name} 券面" class="pt-card-face-img">
          </a>
        `;
      } else {
        visualEl.innerHTML = `
          <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="160" height="100" rx="10" fill="var(--surface)" stroke="var(--line)" stroke-width="1"/>
            <rect x="12" y="14" width="18" height="14" rx="2" fill="#475569"/>
            <circle cx="134" cy="18" r="8" fill="#475569" opacity="0.6"/>
            <circle cx="126" cy="18" r="8" fill="#475569" opacity="0.4"/>
            <g fill="#64748B" font-size="5" font-family="monospace">
              <text x="12" y="58">••••</text><text x="42" y="58">••••</text>
              <text x="72" y="58">••••</text><text x="102" y="58">••••</text>
            </g>
            <text x="12" y="84" fill="#64748B" font-size="6" font-family="monospace">CARDHOLDER</text>
          </svg>
        `;
      }
    }

    // 大きく表示する還元率は「最大○%」や「○〜○%」がある場合は上限を優先。
    // 例：0.5%（対象店7〜8%）→ 8%、0.5%（優待店で最大10%）→ 10%
    function heroRateText(rate){
      const s = String(rate || "");
      let m = s.match(/最大\s*(\d+(?:\.\d+)?)%/);
      if(m) return `最大${m[1]}%`;
      // 「1.0〜3.0%」「対象店7〜8%」などは上限を表示
      const ranges = [...s.matchAll(/(\d+(?:\.\d+)?)\s*[〜~\-–—]\s*(\d+(?:\.\d+)?)%/g)];
      if(ranges.length) return `最大${ranges[ranges.length - 1][2]}%`;
      // 「3.0%以上」のように明確な上振れ表現がある場合
      m = s.match(/(\d+(?:\.\d+)?)%以上/);
      if(m) return `最大${m[1]}%`;
      m = s.match(/(\d+(?:\.\d+)?)%/);
      return m ? `${m[1]}%` : s;
    }
    if(rateEl) rateEl.textContent = heroRateText(card.rate).replace(/%$/, "");
    if(descEl) descEl.textContent = card.why;
    if(baseEl){
      const base = card.rate.match(/(\d+\.?\d*%)/);
      baseEl.textContent = base ? base[1] : card.rate;
    }
    if(feeEl){
      feeEl.textContent = card.fee.includes("無料") ? "無料" : card.fee;
    }
    if(bonusEl){
      if(card.rate.includes("（")){
        const bonus = card.rate.match(/（(.+?)）/);
        bonusEl.textContent = bonus ? bonus[1] : "—";
      } else {
        bonusEl.textContent = "—";
      }
    }

    // Hero detail button
    const detailBtn = document.getElementById("heroDetailBtn");
    if(detailBtn){
      detailBtn.onclick = () => openCardDetailModal(card.name);
    }
    // Hero apply button
    const applyBtn = document.getElementById("heroApplyBtn");
    if(applyBtn){
      const aff = affiliateFor(card.name);
      if(aff){
        applyBtn.onclick = () => window.open(aff, "_blank");
      } else {
        applyBtn.onclick = () => openCardDetailModal(card.name);
      }
    }
  }

  updateHeroCard(defaultCard);

  // More cards button
  const moreBtn = document.getElementById("moreCardsBtn");
  const otherList = document.getElementById("otherCardsList");
  if(moreBtn && otherList){
    let otherOpen = false;
    moreBtn.addEventListener("click", ()=>{
      otherOpen = !otherOpen;
      otherList.style.display = otherOpen ? "block" : "none";
      moreBtn.innerHTML = otherOpen
        ? 'カードリストを閉じる <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>'
        : '他のカードも見る <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
    });

    // Populate other cards as compact candidate cards instead of a long list
    let otherHtml = `<div class="pt-other-cards-head">
      <div>
        <div class="pt-other-cards-title">他にも候補があります</div>
        <div class="pt-other-cards-sub">カードをタップすると、この位置のおすすめが切り替わります</div>
      </div>
    </div>`;
    CARD_PICKS.forEach(g => {
      const items = g.items.filter(c => c.name !== defaultCard.name);
      if(!items.length) return;
      otherHtml += `<div class="pt-other-group">
        <div class="pt-other-group-label">${g.group}</div>
        <div class="pt-other-grid">`;
      items.forEach(c => {
        // 候補カードも、最大還元率がある場合は上限を表示
        const rateText = (()=>{
          const s = String(c.rate || "");
          let m = s.match(/最大\s*(\d+(?:\.\d+)?)%/);
          if(m) return `最大${m[1]}%`;
          const ranges = [...s.matchAll(/(\d+(?:\.\d+)?)\s*[〜~\-–—]\s*(\d+(?:\.\d+)?)%/g)];
          if(ranges.length) return `最大${ranges[ranges.length - 1][2]}%`;
          m = s.match(/(\d+(?:\.\d+)?)%以上/);
          if(m) return `最大${m[1]}%`;
          m = s.match(/(\d+(?:\.\d+)?)%/);
          return m ? `${m[1]}%` : s;
        })();
        otherHtml += `<div class="pt-other-card" data-card-name="${c.name}">
          <div class="pt-other-card-top">
            <div class="pt-other-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div class="pt-other-card-info">
              <div class="pt-other-card-name">${c.name}</div>
              <div class="pt-other-card-fee">${c.fee}</div>
            </div>
          </div>
          <div class="pt-other-card-bottom">
            <div><span class="pt-other-card-rate-num">${rateText}</span><span class="pt-other-card-rate-label">ポイント還元</span></div>
            <span class="pt-other-card-arrow">›</span>
          </div>
        </div>`;
      });
      otherHtml += `</div></div>`;
    });
    otherList.innerHTML = otherHtml;
    otherList.querySelectorAll(".pt-other-card").forEach(el => {
      el.addEventListener("click", ()=>{
        const name = el.dataset.cardName;
        const card = findCardPick(name);
        if(card){
          updateHeroCard(card);
          otherList.style.display = "none";
          otherOpen = false;
          moreBtn.innerHTML = '他のカードも見る <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
          document.getElementById("heroCard")?.scrollIntoView({behavior:"smooth", block:"start"});
        }
      });
    });
  }
})();

renderStores();

// ========== 現在地から探す ==========
// ブラウザのGeolocation APIで現在地を取得し、OpenStreetMap の Overpass API
// （無料・APIキー不要）に「半径1.2km以内にある、登録済みチェーン名の店舗」を
// 問い合わせて、近くにある店舗だけを表示します。
// 注意：Geolocation APIは https（またはlocalhost）でしか動作しません。
// file:// で開いている場合、位置情報の許可ダイアログ自体が出ないことがあります。

function haversineMeters(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// 地図検索に使う店名を作る。
// 「ガスト（すかいらーくグループ）」のような補足付きの名前をそのまま検索すると
// 地図上の「ガスト」に一致しないため、括弧以降を落として検索語にする。
// また、地図には載っていない項目（決済手段やECサイト）は検索対象から除く。
function searchableStoreNames(){
  const SKIP = ["ネット通販", "交通"];
  const out = new Set();
  STORES.forEach(s => {
    if(SKIP.includes(s.category)) return;
    const base = s.name.replace(/[（(].*?[）)]/g, "").replace(/／.*$/, "").trim();
    if(base.length >= 2){
      out.add(base);
      // ハイフンの有無は地図側の登録によって揺れるため、両方を検索語に入れる
      const noHyphen = base.replace(/[-‐‑–—]/g, "");
      if(noHyphen !== base && noHyphen.length >= 2) out.add(noHyphen);
    }
  });
  return [...out];
}

function buildOverpassQuery(lat, lon, radiusMeters, names){
  const escaped = (names || []).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = escaped.join("|");
  // 【重要】名前だけで全要素を舐めると重すぎてタイムアウトするため、
  // まず「店舗・飲食店などの種別を持つ要素」に絞ってから名前で照合する。
  // これでショッピングモール内のテナント（shop/amenity付き）も拾える。
  return `
    [out:json][timeout:25];
    (
      nwr(around:${radiusMeters},${lat},${lon})["shop"]["name"~"${pattern}",i];
      nwr(around:${radiusMeters},${lat},${lon})["shop"]["brand"~"${pattern}",i];
      nwr(around:${radiusMeters},${lat},${lon})["amenity"]["name"~"${pattern}",i];
      nwr(around:${radiusMeters},${lat},${lon})["amenity"]["brand"~"${pattern}",i];
      nwr(around:${radiusMeters},${lat},${lon})["brand"~"${pattern}",i];
    );
    out center;
  `;
}

// 地図から返ってきた名前と、登録店舗を突き合わせる。
// 「ガスト（すかいらーく…）」のような補足は無視して比べる。
// 地図から返ってきた名前と、登録店舗を突き合わせる。
// 「ガスト（すかいらーく…）」のような補足や、ハイフン・中黒・空白の
// 有無といった表記ゆれ（セブン-イレブン / セブンイレブン）を吸収する。
function normalizeName(s){
  return String(s || "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/／.*$/, "")
    .replace(/[-‐‑–—ー・･\s]/g, "")
    .toLowerCase()
    .trim();
}

function findStoreDataByName(rawName){
  const name = normalizeName(rawName);
  if(!name) return null;
  const cand = STORES
    .map(s => ({ s, key: normalizeName(s.name) }))
    .filter(x => x.key.length >= 2 && (name.includes(x.key) || x.key.includes(name)))
    // 「セブンイレブン」と「セブン」のような部分一致では、長い方を優先する
    .sort((a, b) => b.key.length - a.key.length);
  return cand.length ? cand[0].s : null;
}

// Public Overpass API is a shared free service. As of 2026, the original
// overpass-api.de instance is heavily congested; kumi.systems and its
// private.coffee mirror are currently the more reliable public options.
// Kept overpass-api.de last as a final fallback only.
const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function fetchWithTimeout(url, options, timeoutMs){
  const controller = new AbortController();
  const timer = setTimeout(()=> controller.abort(), timeoutMs);
  try{
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function queryOverpassWithFallback(query){
  // Race all mirrors in parallel instead of trying them one-by-one — much
  // faster in the common case, and we only wait as long as the slowest
  // *successful* response instead of stacking up multiple timeouts.
  const attempts = OVERPASS_ENDPOINTS.map(endpoint =>
    fetchWithTimeout(endpoint, { method: "POST", body: query }, 25000)
      .then(async (res) => {
        if(!res.ok){
          throw new Error(`${endpoint.replace("https://","")} が HTTP ${res.status} を返しました`);
        }
        const text = await res.text();
        try{
          return JSON.parse(text);
        } catch {
          const firstLine = text.split("\n").find(l => l.trim()) || text.slice(0, 100);
          throw new Error(`${endpoint.replace("https://","")} が不正な応答: ${firstLine}`);
        }
      })
      .catch(err => {
        // Normalize abort errors into a readable Japanese message.
        if(err.name === "AbortError"){
          throw new Error(`${endpoint.replace("https://","")} が25秒以内に応答しませんでした`);
        }
        throw err;
      })
  );

  try{
    return await Promise.any(attempts);
  } catch(aggregateErr){
    const details = (aggregateErr.errors || [aggregateErr])
      .map(e => e.message)
      .join(" ／ ");
    throw new Error(details || "すべてのサーバーへの接続に失敗しました");
  }
}

async function searchNearby(){
  const btn = document.getElementById("nearbyBtn");
  const resultBox = document.getElementById("nearbyResults");
  const statusEl = document.getElementById("nearbyStatus");

  if(!("geolocation" in navigator)){
    statusEl.textContent = "この端末・ブラウザは位置情報に対応していません。";
    return;
  }

  btn.disabled = true;
  statusEl.textContent = "現在地を取得中…";
  resultBox.innerHTML = "";

  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const { latitude, longitude, accuracy } = pos.coords;
    // 商業施設の中は衛星が届かず測位誤差が広がるので、それに応じて半径を広げる
    const radius = Math.min(2000, Math.max(800, Math.round((accuracy || 0) * 2 + 600)));
    statusEl.textContent = `周辺のお店を検索中…（測位誤差 約${Math.round(accuracy || 0)}m）`;

    try{
      const query = buildOverpassQuery(latitude, longitude, radius, searchableStoreNames());
      const data = await queryOverpassWithFallback(query);

      const matches = [];
      const seen = new Set();
      (data.elements || []).forEach(el => {
        const tagName = (el.tags && (el.tags.name || el.tags.brand)) || "";
        if(!tagName) return;
        const storeData = findStoreDataByName(tagName);
        if(!storeData) return;

        const lat = el.lat ?? (el.center && el.center.lat);
        const lon = el.lon ?? (el.center && el.center.lon);
        if(lat == null || lon == null) return;

        const dist = haversineMeters(latitude, longitude, lat, lon);
        const key = storeData.name + "_" + Math.round(lat*1000) + "_" + Math.round(lon*1000);
        if(seen.has(key)) return;
        seen.add(key);
        matches.push({ storeData, tagName, dist });
      });

      matches.sort((a,b)=> a.dist - b.dist);

      if(matches.length === 0){
        statusEl.textContent = `半径${radius}m以内に登録済みのお店が見つかりませんでした。特約のないお店なら、上の「今すぐ払う」で『その他のお店』を選ぶと、どこでも使える決済を比較できます。`;
        return;
      }

      statusEl.textContent = `近くで見つかった登録済み店舗：${matches.length}件（近い順に5件を表示）`;
      matches.slice(0, 5).forEach(m => {
        const card = buildStoreCardEl(m.storeData, m.dist);
        resultBox.appendChild(card);
      });

    } catch(err){
      // Show the real error inline (not just a generic message) so it can
      // be screenshotted and reported without needing browser dev tools.
      // Public Overpass servers get congested at busy times — most
      // failures here are server-side, not a bug in this page.
      // 詳細な技術メッセージは畳んでおき、まず再試行を促す
      statusEl.innerHTML =
        `地図サーバーが混み合っています。少し待ってから、もう一度ボタンを押してください。`
        + `<div class="err-detail"><details><summary>詳細</summary>${escapeHtml(String(err.message || err))}</details></div>`;
      console.error(err);
    } finally {
      btn.disabled = false;
    }

  }, (err)=>{
    btn.disabled = false;
    if(err.code === err.PERMISSION_DENIED){
      statusEl.textContent = "位置情報の利用が許可されませんでした。設定アプリからこのサイトの位置情報アクセスを確認してください。";
    } else {
      statusEl.textContent = "位置情報を取得できませんでした（file://で開いている場合、httpsでの公開が必要な場合があります）。";
    }
  }, { enableHighAccuracy: true, timeout: 10000 });
}

document.getElementById("nearbyBtn").addEventListener("click", searchNearby);

// ========== 編集モード：モーダル＆CRUD ==========

// ========== カード詳細モーダル ==========
// CARD_PICKSのデータを流用し、カード名から詳細を引いて表示する。
// おすすめバナーの「詳細を見る」ボタンと、将来的にはカード名タップからも呼べる。
function openCardDetailModal(cardName){
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  if(!overlay || !box) return;

  // CARD_PICKSから一致するカードを探す
  let card = null;
  for(const g of CARD_PICKS){
    const found = g.items.find(i => i.name === cardName);
    if(found){ card = found; break; }
  }

  // UNIVERSAL_PAYMENTSからも探す
  if(!card){
    const u = UNIVERSAL_PAYMENTS.find(p => p.name === cardName);
    if(u) card = { name: u.name, rate: u.rate, fee: "", why: u.note || "", url: u.url };
  }

  if(!card){
    // データが無ければ何も表示しない（graceful fallback）
    return;
  }

  const aff = affiliateFor(card.name);

  box.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${card.name}</span>
      <button class="modal-close" id="cardDetailClose">✕</button>
    </div>
    <div style="padding:0 16px 16px;">
      <div class="card-detail-rate">${card.rate || ""}</div>
      ${card.fee ? `<div class="card-detail-fee">${card.fee}</div>` : ""}
      <div class="card-detail-why">${card.why || ""}</div>
      ${card.good ? `<div class="card-detail-good"><b>向いている人：</b>${card.good}</div>` : ""}
      ${card.detail ? `<div class="card-option-note" style="margin-top:10px;">${formatNote(card.detail)}</div>` : ""}
      ${card.affiliateBannerUrl ? `
        <a href="${card.affiliateBannerLink}" target="_blank" rel="sponsored noopener nofollow" style="display:block;margin-top:12px;">
          <img src="${card.affiliateBannerUrl}" alt="${card.name} PR" style="display:block;width:100%;height:auto;border-radius:8px;">
        </a>` : ""}
      <div class="modal-actions" style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
        ${aff ? `<a class="featured-apply-btn" href="${aff}" target="_blank" rel="sponsored noopener noreferrer" style="flex:1; text-align:center; padding:12px;">このカードに申し込む ↗</a>` : ""}
        ${card.url ? `<a class="src-link" href="${card.url}" target="_blank" rel="noopener noreferrer" style="display:block; margin-top:4px; font-size:12px;">公式サイトで詳細を見る ↗</a>` : ""}
      </div>
    </div>
  `;

  overlay.style.display = "flex";
  box.querySelector("#cardDetailClose").addEventListener("click", ()=>{ overlay.style.display = "none"; });
}

function showModal(title, fields, onSave, onDelete){
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  const fieldsHtml = fields.map(f => {
    if(f.type === "textarea"){
      return `<div class="modal-field"><label>${f.label}</label><textarea data-key="${f.key}">${f.value ? escapeHtml(f.value) : ""}</textarea></div>`;
    }
    if(f.type === "select"){
      const opts = f.options.map(o => `<option value="${escapeAttr(o)}" ${o === f.value ? "selected" : ""}>${escapeHtml(o)}</option>`).join("");
      return `<div class="modal-field"><label>${f.label}</label><select data-key="${f.key}">${opts}</select></div>`;
    }
    return `<div class="modal-field"><label>${f.label}</label><input type="${f.type === "password" ? "password" : "text"}" data-key="${f.key}" value="${f.value ? escapeAttr(f.value) : ""}"></div>`;
  }).join("");

  box.innerHTML = `
    <div class="modal-title">${title}</div>
    ${fieldsHtml}
    <div class="modal-actions">
      ${onDelete ? `<button class="modal-btn delete" id="modalDeleteBtn">削除</button>` : ""}
      <button class="modal-btn cancel" id="modalCancelBtn">キャンセル</button>
      <button class="modal-btn save" id="modalSaveBtn">保存</button>
    </div>
  `;

  overlay.style.display = "flex";

  const close = () => { overlay.style.display = "none"; };

  document.getElementById("modalCancelBtn").addEventListener("click", close);
  overlay.addEventListener("click", (e)=>{ if(e.target === overlay) close(); }, { once: true });

  document.getElementById("modalSaveBtn").addEventListener("click", ()=>{
    const values = {};
    fields.forEach(f => {
      const el = box.querySelector(`[data-key="${f.key}"]`);
      values[f.key] = el.value.trim();
    });
    // 1つ目がセレクトのときは必須チェックの対象にしない（下の欄に直接入力する運用があるため）
    if(fields[0].type !== "select" && !values[fields[0].key]){
      alert(`${fields[0].label}は必須です`);
      return;
    }
    onSave(values);
    close();
  });

  if(onDelete){
    document.getElementById("modalDeleteBtn").addEventListener("click", ()=>{
      if(confirm("本当に削除しますか？")){
        onDelete();
        close();
      }
    });
  }
}

function escapeHtml(str){
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function escapeAttr(str){
  return String(str).replace(/&/g,"&amp;").replace(/"/g,"&quot;");
}
// href属性に入れて問題ないURLか（http/httpsのみ許可）。
// javascript: 等の危険なスキームや、AIの誤生成による不正な文字列を弾くためのチェック。
function isSafeHttpUrl(str){
  if(!str || typeof str !== "string") return false;
  try{
    const u = new URL(str, location.href);
    return u.protocol === "http:" || u.protocol === "https:";
  }catch(_e){
    return false;
  }
}

// ---- チャージルートの追加・編集・削除 ----
// 構造が複雑（howto/split/starters等のネスト）なため、店舗編集のような項目別フォームではなく
// JSON全体を直接編集する方式にしている。使い慣れた人が自分で直せるようにするための割り切り。

const NEW_ROUTE_TEMPLATE = {
  name: "",
  howto: { prep: [], flow: [], time: "" },
  split: [],
  pays: [],
  total: "",
  steps: [],
  gains: [],
  starter: "",
  atStore: { rate: "", method: "" },
  note: "",
  url: "",
  caution: "",
  starters: {}
};

function openRouteModal(route){
  const isNew = route === null;
  showModal(
    isNew ? "新しいルートを追加（JSON形式）" : "ルートを編集（JSON形式）",
    [
      { key: "json", label: "ルートデータ（JSON）。name・steps・gains は必須です。", type: "textarea",
        value: JSON.stringify(isNew ? NEW_ROUTE_TEMPLATE : route, null, 2) }
    ],
    (vals)=>{
      let parsed;
      try{
        parsed = JSON.parse(vals.json);
      } catch(e){
        alert("JSONの形式が正しくありません：" + e.message);
        return;
      }
      if(!parsed || typeof parsed !== "object" || !parsed.name){
        alert("nameは必須です");
        return;
      }
      if(isNew){
        CHARGE_ROUTES.push(parsed);
      } else {
        const idx = CHARGE_ROUTES.indexOf(route);
        if(idx >= 0) CHARGE_ROUTES[idx] = parsed;
      }
      persistRoutes();
      renderRoutes();
    },
    isNew ? null : ()=>{
      const idx = CHARGE_ROUTES.indexOf(route);
      if(idx >= 0) CHARGE_ROUTES.splice(idx, 1);
      persistRoutes();
      renderRoutes();
    }
  );
}

document.getElementById("addRouteBtn")?.addEventListener("click", ()=> openRouteModal(null));

document.getElementById("resetRoutesBtn")?.addEventListener("click", ()=>{
  if(!confirm("この端末で編集したチャージルートをすべて削除し、初期データに戻します。よろしいですか？")) return;
  CHARGE_ROUTES = JSON.parse(JSON.stringify(DEFAULT_ROUTES));
  persistRoutes();
  renderRoutes();
});

// ---- お店の追加・編集・削除 ----

function openStoreModal(store){
  // store === null → 新規追加
  const isNew = store === null;
  showModal(
    isNew ? "新しいお店を追加" : "お店情報を編集",
    [
      { key: "name", label: "店名（例：モスバーガー）", value: store ? store.name : "" },
      { key: "category", label: "カテゴリ", type: "select", options: CATEGORY_LIST, value: store ? store.category : CATEGORY_LIST[0] },
      { key: "excludes", label: "使えない決済", type: "select",
        options: ["なし", "コード決済が使えない", "電子マネーが使えない（交通系ICは可）",
                  "電子マネーも交通系ICも使えない", "コード決済も電子マネーも使えない（交通系ICは可）",
                  "コード決済・電子マネー・交通系ICすべて使えない"],
        value: (()=>{
          const ex = (store && store.excludes) || [];
          const q = ex.includes("qr"), e = ex.includes("emoney"), t = ex.includes("transit");
          if(q && e && t) return "コード決済・電子マネー・交通系ICすべて使えない";
          if(q && e) return "コード決済も電子マネーも使えない（交通系ICは可）";
          if(e && t) return "電子マネーも交通系ICも使えない";
          if(q) return "コード決済が使えない";
          if(e) return "電子マネーが使えない（交通系ICは可）";
          return "なし";
        })() },
      { key: "acceptNote", label: "使える決済の補足（任意）", type: "textarea", value: store ? (store.acceptNote || "") : "" },
    ],
    (vals)=>{
      const ex = [];
      if(/コード決済/.test(vals.excludes)) ex.push("qr");
      if(/電子マネー/.test(vals.excludes)) ex.push("emoney");
      if(/交通系ICも|すべて/.test(vals.excludes)) ex.push("transit");
      if(isNew){
        const newStore = { name: vals.name, category: vals.category || "未分類", cards: [] };
        if(ex.length) newStore.excludes = ex;
        if(vals.acceptNote) newStore.acceptNote = vals.acceptNote;
        STORES.push(newStore);
        persistStores();
        renderStores();
        // 新規店舗は続けてカード追加モーダルを開く
        openCardModal(newStore, null);
      } else {
        store.name = vals.name;
        store.category = vals.category || "未分類";
        if(ex.length) store.excludes = ex; else delete store.excludes;
        if(vals.acceptNote) store.acceptNote = vals.acceptNote; else delete store.acceptNote;
        persistStores();
        renderStores();
      }
    },
    isNew ? null : ()=> deleteStore(store)
  );
}

function deleteStore(store){
  if(!confirm(`「${store.name}」を削除しますか？`)) return;
  const idx = STORES.indexOf(store);
  if(idx === -1) return;
  STORES.splice(idx, 1);
  persistStores();
  renderStores();
  renderCampaigns();
}

// ---- カードの追加・編集・削除 ----

function openCardModal(store, card){
  const isNew = card === null;
  showModal(
    isNew ? `${store.name} にカードを追加` : `${store.name} のカード情報を編集`,
    [
      { key: "preset", label: "決済手段を選ぶ（一覧にない場合は下の欄に直接入力）", type: "select",
        options: ["（下の欄に入力する）"].concat(WALLET_OPTIONS),
        value: (card && WALLET_OPTIONS.includes(card.name)) ? card.name : "（下の欄に入力する）" },
      { key: "name", label: "カード名（上で選んだ場合は空欄でOK）", value: card ? card.name : "" },
      { key: "rate", label: "還元率（例：7%＋α）", value: card ? card.rate : "" },
      { key: "method", label: "対象の支払い方法", value: card ? card.method : "" },
      { key: "expires", label: "終了日（期間限定の場合のみ。例：2026-08-31／常設なら空欄）", value: card ? card.expires : "" },
      { key: "url", label: "公式ページのURL（任意）", value: card ? card.url : "" },
      { key: "articleUrl", label: "くわしい記事へのリンク（任意・自分の記事へ「詳しくはこちら」ボタンを出す）", value: card ? card.articleUrl : "" },
      { key: "image", label: "画像URL（任意・キャンペーンバナーなどを貼りたい場合）", value: card ? card.image : "" },
      { key: "note", label: "補足・注意点（任意）", type: "textarea", value: card ? card.note : "" },
    ],
    (vals)=>{
      // 一覧から選んでいればその名前を使う（表記ゆれで保有カード判定が効かなくなるのを防ぐ）
      const cardName = (vals.preset && !vals.preset.startsWith("（")) ? vals.preset : vals.name;
      if(!cardName){ alert("決済手段を選ぶか、カード名を入力してください"); return; }
      vals.name = cardName;
      if(isNew){
        store.cards.push({ name: vals.name, rate: vals.rate, method: vals.method, note: vals.note,
                           expires: vals.expires || undefined, url: vals.url || undefined,
                           articleUrl: vals.articleUrl || undefined, image: vals.image || undefined });
      } else {
        card.name = vals.name;
        card.rate = vals.rate;
        card.method = vals.method;
        card.note = vals.note;
        if(vals.expires) card.expires = vals.expires;
        else delete card.expires;
        if(vals.url) card.url = vals.url;
        else delete card.url;
        if(vals.articleUrl) card.articleUrl = vals.articleUrl;
        else delete card.articleUrl;
        if(vals.image) card.image = vals.image;
        else delete card.image;
      }
      persistStores();
      renderStores();
      renderCampaigns();
    },
    isNew ? null : ()=> deleteCard(store, card)
  );
}

function deleteCard(store, card){
  if(!confirm(`「${card.name}」の情報を削除しますか？`)) return;
  const idx = store.cards.indexOf(card);
  if(idx === -1) return;
  store.cards.splice(idx, 1);
  persistStores();
  renderStores();
  renderCampaigns();
}

// ---- 編集モードのON/OFF、追加ボタン、リセット ----

// ========== 編集モードのパスワード保護 ==========
// GitHubのPersonal Access Tokenを紛失したのをきっかけに追加。
// トークンは書き込み権限を持つため埋め込むと危険（過去に却下済み）だが、
// このパスワードは「編集モードのボタン類を見せるかどうか」を制御するだけで、
// 実際にGitHubへ保存するには別途GitHub連携（PAT）の設定が必要なので、
// ソースに平文ではなくハッシュ値を埋め込む形にしてある。
//
// パスワードを変更したいときは、ブラウザのコンソール（F12）で次を実行してハッシュを再計算し、
// 出てきた64文字の値で下のEDITOR_PASSWORD_HASHを書き換えてください：
//   await crypto.subtle.digest("SHA-256", new TextEncoder().encode("新しいパスワード"))
//     .then(b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""))
const EDITOR_PASSWORD_HASH = "d58217ab8d1a67569277d17e6f84373a10e43fb3414a88bdbecb575480c5f79f"; // ← 64文字のハッシュ値を入れる。未設定のままだと誰でも編集モードに入れてしまいます
const EDITOR_AUTH_KEY = "kangenchou_editor_ok";
// AI取り込み（Cloudflare Worker）の認証に使う。sessionStorage等には保存せず、
// このタブを開いている間だけメモリ上に保持する（平文パスワードを永続化しないため）。
let editorPlaintextPassword = null;

async function sha256Hex(str){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// 同じタブでの再入力を防ぐため、認証済みかどうかはタブが開いている間だけ覚える（sessionStorage）
async function ensureEditorAuth(){
  if(!EDITOR_PASSWORD_HASH){
    console.warn("EDITOR_PASSWORD_HASHが未設定のため、編集モードは誰でも入れる状態です。");
    return true;
  }
  try{
    if(sessionStorage.getItem(EDITOR_AUTH_KEY) === "1") return true;
  } catch {}
  const pw = prompt("編集モードのパスワードを入力してください");
  if(pw === null) return false; // キャンセル
  const hash = await sha256Hex(pw);
  if(hash !== EDITOR_PASSWORD_HASH){
    alert("パスワードが違います");
    return false;
  }
  editorPlaintextPassword = pw; // メモリ上にのみ保持（sessionStorageや変数の永続化はしない）
  try{ sessionStorage.setItem(EDITOR_AUTH_KEY, "1"); } catch {}
  return true;
}

// AI取り込み（Cloudflare Worker呼び出し）専用の認証。
// 「編集モードに入れているか」だけではWorker側の本人確認にはならない（画面上のボタン表示を
// 隠しているだけで、誰でもJSから直接関数を呼べてしまうため）。そこでWorker呼び出し時は、
// 編集モードのパスワードそのもの（平文）を毎回リクエストに含めて送り、Worker側で
// そのSHA-256ハッシュがEDITOR_PASSWORD_HASHと一致するかを検証してもらう。
// パスワードはメモリ上にのみ保持し、ページを再読み込みすれば消える。
async function ensureAiImportSecret(){
  if(editorPlaintextPassword) return editorPlaintextPassword;
  if(!EDITOR_PASSWORD_HASH){
    console.warn("EDITOR_PASSWORD_HASHが未設定のため、AI取り込みの認証をスキップします。");
    return "";
  }
  const pw = prompt("AI取り込み機能を使うには、編集モードのパスワードを入力してください");
  if(pw === null) return null;
  const hash = await sha256Hex(pw);
  if(hash !== EDITOR_PASSWORD_HASH){
    alert("パスワードが違います");
    return null;
  }
  editorPlaintextPassword = pw;
  try{ sessionStorage.setItem(EDITOR_AUTH_KEY, "1"); } catch {}
  return pw;
}

document.getElementById("editModeBtn").addEventListener("click", async ()=>{
  if(!editMode){
    const ok = await ensureEditorAuth();
    if(!ok) return;
  }
  editMode = !editMode;
  document.getElementById("editModeBtn").classList.toggle("on", editMode);
  document.getElementById("panel-stores").classList.toggle("edit-mode", editMode);
  document.getElementById("panel-campaigns").classList.toggle("edit-mode", editMode);
  document.getElementById("panel-routes").classList.toggle("edit-mode", editMode);
  renderStores();
  renderPicks();
  renderRoutes();
  renderHealthCheckBanner();
  renderGithubConnectionBanner();
});

document.getElementById("addStoreBtn").addEventListener("click", ()=> openStoreModal(null));
document.getElementById("addPickBtn").addEventListener("click", ()=> openPickModal(null));

document.getElementById("resetStoresBtn").addEventListener("click", ()=>{
  if(!confirm("この端末で編集した内容をすべて削除し、初期データに戻します。よろしいですか？")) return;
  STORES = injectArticleUrls(JSON.parse(JSON.stringify(DEFAULT_STORES)));
  persistStores();
  renderStores();
  renderCampaigns();
});

// ========== GitHub 自動同期 ==========

// UTF-8文字列を安全にbase64化する（日本語を含むためbtoa単体では壊れる）
function utf8ToBase64(str){
  return btoa(unescape(encodeURIComponent(str)));
}

// 任意のJSONファイルをGitHubにコミットする汎用関数。
// stores.json と affiliates.json の両方で使う。
async function pushJsonToGithub(path, data, label){
  const cfg = loadGithubConfig();
  if(!cfg || !cfg.username || !cfg.repo || !cfg.token){
    return false; // 未設定なら何もしない（ローカル保存のみ）
  }

  setSyncStatus(`GitHubに保存中…（${label}）`, "busy");

  const apiUrl = `https://api.github.com/repos/${cfg.username}/${cfg.repo}/contents/${path}`;
  const branch = cfg.branch || "main";

  try{
    // 1. 現在のファイルのshaを取得（更新には必須。ファイルがまだ無ければ新規作成）
    let sha = undefined;
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" }
    });
    if(getRes.status === 200){
      const getData = await getRes.json();
      sha = getData.sha;
    } else if(getRes.status !== 404){
      throw new Error(`ファイル取得に失敗（HTTP ${getRes.status}）`);
    }

    // 2. 更新（またはファイルが無ければ新規作成）をコミット
    const content = utf8ToBase64(JSON.stringify(data, null, 2));
    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `ペイ択：編集モードから${path}を更新`,
        content,
        branch,
        ...(sha ? { sha } : {})
      })
    });

    if(!putRes.ok){
      const errBody = await putRes.text();
      throw new Error(`コミットに失敗（HTTP ${putRes.status}）：${errBody.slice(0,150)}`);
    }

    setSyncStatus(`✅ GitHubに保存済み：${label}（${new Date().toLocaleTimeString("ja-JP")}）`, "ok");
    return true;
  } catch(err){
    setSyncStatus(`⚠️ GitHubへの保存に失敗（${label}）：${err.message}（この端末には保存済み）`, "err");
    console.error(err);
    return false;
  }
}

async function pushStoresToGithub(){
  const ok = await pushJsonToGithub(STORES_JSON_PATH, STORES, "店舗データ");
  syncPending = !ok && !!loadGithubConfig();
}

async function pushAffiliatesToGithub(){
  await pushJsonToGithub(AFFILIATES_JSON_PATH, affiliates, "紹介リンク");
}

async function pushRoutesToGithub(){
  const ok = await pushJsonToGithub(ROUTES_JSON_PATH, CHARGE_ROUTES, "チャージルート");
  routesSyncPending = !ok && !!loadGithubConfig();
}

function persistStores(){
  saveStoresToCache();
  pushStoresToGithub(); // 非同期。設定が無ければ内部で何もしない
}

function persistRoutes(){
  saveRoutesToCache();
  refreshWalletOptions(); // ルートを追加・編集・削除するたびに「持っているカード・決済」の選択肢も自動更新する
  pushRoutesToGithub(); // 非同期。設定が無ければ内部で何もしない
}

// ---- GitHub連携の設定モーダル ----

// 紹介リンク管理（admin/affiliates.html）には「✓ GitHub接続済み」の常時バナーがあるが、
// こちら（ホーム画面の編集モード）にはこれまで無く、編集して保存が成功するまで
// 「ちゃんと繋がっているか」を確認する手段が無かった。編集モードに入るたびに
// 接続設定の有無を表示しておくことで、実際に編集する前に確認できるようにする。
function renderGithubConnectionBanner(){
  if(!editMode) return;
  const cfg = loadGithubConfig();
  if(cfg && cfg.username && cfg.repo && cfg.token){
    setSyncStatus(`✓ GitHub連携済み（${cfg.username}/${cfg.repo}）。編集を保存すると自動でここに反映結果が表示されます。`, "ok");
  } else {
    setSyncStatus("⚠️ GitHub未接続です。このままだと編集内容はこの端末（ブラウザ）にしか保存されず、他の人には反映されません。「🔗 GitHub連携」から設定してください。", "");
  }
}

document.getElementById("githubSettingsBtn").addEventListener("click", ()=>{
  const cfg = loadGithubConfig() || {};
  showModal(
    "GitHub連携の設定",
    [
      { key: "username", label: "GitHubユーザー名", value: cfg.username || "" },
      { key: "repo", label: "リポジトリ名（例：kangenchou）", value: cfg.repo || "" },
      { key: "branch", label: "ブランチ名（通常は main）", value: cfg.branch || "main" },
      { key: "token", label: "Personal Access Token（Fine-grained・対象リポジトリ限定・Contents: Read and write のみ・有効期限は短めに）", type: "password", value: cfg.token || "" },
    ],
    (vals)=>{
      saveGithubConfig(vals);
      setSyncStatus("GitHub連携を保存しました。次の編集から自動で同期されます。", "ok");
    }
  );
});

// ========== サイト運営の健全性チェック（編集モード内でのバナー表示） ==========
// build-articles.mjs が生成する content/health-check.json（リンク切れ・未収益化の
// アフィリエイトリンク・確認日の鮮度）を読み込み、編集モード中だけ画面上部に
// バナーとして表示する。GitHub Actionsのログを見に行かなくても、サイト内で
// そのまま確認・対応できるようにするための機能。
const HEALTH_CHECK_JSON_PATH = "content/health-check.json";
let healthCheck = null;

async function refreshHealthCheck(){
  try{
    const res = await fetch(`${HEALTH_CHECK_JSON_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if(!res.ok) return; // まだファイルが無い場合は静かに無視
    healthCheck = await res.json();
    renderHealthCheckBanner();
  } catch(e){
    console.info("health-check.json の取得をスキップしました", e.message);
  }
}

function healthCheckTotal(){
  if(!healthCheck) return 0;
  return (healthCheck.brokenLinks?.length || 0)
    + (healthCheck.unmonetizedLinks?.length || 0)
    + (healthCheck.staleContent?.length || 0);
}

function renderHealthCheckBanner(){
  const el = document.getElementById("healthCheckBanner");
  if(!el) return;

  if(!editMode || !healthCheck || healthCheckTotal() === 0){
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }

  const esc = v => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const section = (title, items, renderItem) => {
    if(!items || items.length === 0) return "";
    return `<div class="health-check-group">
      <div class="health-check-group-title">${title}（${items.length}件）</div>
      ${items.map(renderItem).join("")}
    </div>`;
  };

  const generatedLabel = healthCheck.generatedAt
    ? new Date(healthCheck.generatedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  el.style.display = "block";
  el.innerHTML = `
    <div class="health-check-head">
      <span class="health-check-title">⚠️ サイト運営チェック（${healthCheckTotal()}件）</span>
      <span class="health-check-time">${generatedLabel}時点</span>
      <button type="button" class="health-check-close" id="healthCheckCloseBtn" aria-label="閉じる">×</button>
    </div>
    ${section("未収益化のアフィリエイトリンク", healthCheck.unmonetizedLinks, p => `
      <div class="health-check-item">
        <a href="articles/${esc(p.file)}" target="_blank">${esc(p.file)}</a>
        <span class="health-check-detail">key="${esc(p.key)}" ／ ${esc(p.kind)}</span>
      </div>`)}
    ${section("確認日が古くなった記述", healthCheck.staleContent, s => `
      <div class="health-check-item">
        <a href="articles/${esc(s.file)}" target="_blank">${esc(s.file)}</a>
        <span class="health-check-detail">確認日: ${esc(s.date)}（${s.days}日経過）</span>
      </div>`)}
    ${section("内部リンク切れ", healthCheck.brokenLinks, b => `
      <div class="health-check-item">
        <a href="articles/${esc(b.file)}" target="_blank">${esc(b.file)}</a>
        <span class="health-check-detail">[${esc(b.kind)}] ${esc(b.detail)}</span>
      </div>`)}
  `;

  document.getElementById("healthCheckCloseBtn")?.addEventListener("click", ()=>{
    el.style.display = "none";
  });
}

// 初回読み込み時に、GitHub上の最新データを取得しにいく
refreshFromGithubPages();
refreshAffiliatesFromGithubPages();
refreshPicksFromGithubPages();
refreshRoutesFromGithubPages();
refreshHealthCheck();
renderMufg();

// ========== ハッシュルーティング（別ページ） ==========
// paytaku.github.io/#/dmm → DMM株LP
// paytaku.github.io/#/aupay-market → au PAYマーケットLP
// それ以外 → 通常のペイ択アプリ

const LP_ROUTES = {
  "/kabu-koza": "lp-dmm",
  "/nettsuuhan": "lp-aupay",
  "/odakyu-point": "lp-odakyu",
  "/privacy": "lp-privacy",
  "/about": "lp-about"
};

// LPページのメタ情報（SEO用）
const LP_META = {
  "/kabu-koza": {
    title: "手数料最安水準の株口座 | ペイ択",
    description: "クレカ積立と組み合わせやすい株口座の特徴とペイ択との使い方。口座開設は最短即日、スマホで日本株・米国株が取引できる。"
  },
  "/nettsuuhan": {
    title: "チャージルートで貯めたポイントが使えるネット通販 | ペイ択",
    description: "チャージルートで貯めたPontaポイント・au PAY残高をそのまま使えるネット通販。ポイント二重取りができる。"
  },
  "/odakyu-point": {
    title: "小田急ポイントカード — 沿線で最大10%還元 | ペイ択",
    description: "小田急百貨店で最大10%、Odakyu OXで5%OFF。PASMOオートチャージにも対応。小田急沿線で暮らす人のためのカード。"
  },
  "/privacy": {
    title: "プライバシーポリシー | ペイ択",
    description: "ペイ択における個人情報の取り扱い・Cookie・アフィリエイトプログラムの利用について。"
  },
  "/about": {
    title: "運営者情報 | ペイ択",
    description: "ペイ択の運営者・お問い合わせ先・情報の正確性についてのご案内。"
  }
};

function showLP(id){
  document.querySelector(".wrap").style.display = "none";
  document.querySelectorAll(".lp-page").forEach(p => p.style.display = "none");
  const lp = document.getElementById(id);
  if(lp){ lp.style.display = ""; window.scrollTo(0, 0); }
}

function showMain(){
  document.querySelector(".wrap").style.display = "";
  document.querySelectorAll(".lp-page").forEach(p => p.style.display = "none");
}

function applyRoute(){
  const hash = window.location.hash;
  const path = hash.startsWith("#/") ? hash.slice(1) : null;

  const lpId = path ? LP_ROUTES[path] : null;

  if(lpId){
    const meta = LP_META[path];
    if(meta){
      document.title = meta.title;
      document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
    }
    showLP(lpId);
  } else {
    document.title = "ペイ択（Paytaku）";
    document.querySelector('meta[name="description"]')?.setAttribute("content", "レジの前で「どのカード・どの決済で払うのが一番おトクか」が3秒でわかる。クレカ・スマホ決済・チャージルートを横断して、お店ごとの還元率を比較できます。");
    showMain();
  }
}

// 戻るボタン
["lpDmmBack","lpDmmBack2","lpAupayBack","lpAupayBack2","lpOdakyuBack","lpOdakyuBack2","lpPrivacyBack","lpPrivacyBack2","lpAboutBack","lpAboutBack2"].forEach(id => {
  document.getElementById(id)?.addEventListener("click", e => {
    e.preventDefault();
    history.pushState(null, "", window.location.pathname);
    applyRoute();
  });
});

// ハッシュ変更（ブラウザの進む・戻るボタン）
window.addEventListener("hashchange", applyRoute);

// 初期ルーティング
applyRoute();



// ========== Bottom navigation ==========
// 下部ナビは見た目だけでなく、既存の「モード切替」と連動させる。
(function(){
  const nav = document.getElementById("bottomNav");
  if(!nav) return;

  const HISTORY_KEY = "paytaku_compare_history_v1";

  function loadHistory(){
    try{
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  }
  function saveHistory(list){
    try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0,20))); }catch(e){}
  }

  function rememberStore(name){
    if(!name) return;
    const list = loadHistory().filter(x => x.name !== name);
    list.unshift({name, time: new Date().toISOString()});
    saveHistory(list);
  }

  // 店舗選択を比較履歴として保存
  document.getElementById("answerStore")?.addEventListener("change", e => {
    rememberStore(e.target.value);
  });

  function closeSheet(){
    const overlay=document.getElementById("navSheetOverlay");
    if(overlay) overlay.classList.remove("open");
  }

  function openSheet(title, html){
    let overlay=document.getElementById("navSheetOverlay");
    if(!overlay){
      overlay=document.createElement("div");
      overlay.id="navSheetOverlay";
      overlay.className="nav-sheet-overlay";
      overlay.innerHTML=`<div class="nav-sheet" role="dialog" aria-modal="true">
        <div class="nav-sheet-head"><h2 class="nav-sheet-title"></h2><button class="nav-sheet-close" type="button" aria-label="閉じる">×</button></div>
        <div class="nav-sheet-content"></div>
      </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", e=>{ if(e.target===overlay) closeSheet(); });
      overlay.querySelector(".nav-sheet-close").addEventListener("click", closeSheet);
    }
    overlay.querySelector(".nav-sheet-title").textContent=title;
    overlay.querySelector(".nav-sheet-content").innerHTML=html;
    overlay.classList.add("open");
    return overlay;
  }

  function activateMode(mode, scrollTarget){
    // LPを表示中なら通常アプリへ戻す
    if(typeof showMain === "function") showMain();
    if(window.location.hash) history.pushState(null,"",window.location.pathname);

    const btn=document.querySelector(`.mode-btn[data-mode="${mode}"]`);
    if(btn) btn.click();
    document.querySelectorAll(".bottom-nav-item").forEach(b=>b.classList.remove("active"));

    requestAnimationFrame(()=>{
      if(scrollTarget){
        const el=document.getElementById(scrollTarget);
        if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
      }else{
        window.scrollTo({top:0,behavior:"smooth"});
      }
    });
  }

  function showHistory(){
    const list=loadHistory();
    if(!list.length){
      openSheet("比較履歴", `<p class="nav-sheet-empty">まだ比較履歴がありません。<br>「お店から選ぶ」でお店を選ぶと、ここに履歴が表示されます。</p>`);
      return;
    }
    const html=list.map(item=>{
      const d=new Date(item.time);
      const when=Number.isNaN(d.getTime()) ? "" : d.toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
      return `<button type="button" class="nav-history-item" data-history-store="${String(item.name).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;")}"><span><strong>${String(item.name).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</strong><span class="nav-item-sub">${when}</span></span><span>›</span></button>`;
    }).join("");
    const overlay=openSheet("比較履歴", html);
    overlay.querySelectorAll("[data-history-store]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const name=btn.dataset.historyStore;
        closeSheet();
        activateMode("stores","answerBox");
        const sel=document.getElementById("answerStore");
        if(sel){
          const opt=[...sel.options].find(o=>o.value===name);
          if(opt){ sel.value=name; sel.dispatchEvent(new Event("change",{bubbles:true})); }
        }
      });
    });
  }

  function showFavorites(){
    const storeList=typeof favs !== "undefined" ? STORES.filter(s=>favs.has(s.name)) : [];
    const routeList=typeof routeFavs !== "undefined" ? CHARGE_ROUTES.filter(r=>routeFavs.has(r.name)) : [];
    if(!storeList.length && !routeList.length){
      openSheet("お気に入り", `<p class="nav-sheet-empty">お気に入りがまだありません。<br>お店やチャージルートの☆をタップすると追加できます。</p>`);
      return;
    }
    const esc=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
    const storeHtml=storeList.length ? `<div class="nav-fav-section-title">お店</div>` + storeList.map(s=>{
      const safe=esc(s.name);
      return `<button type="button" class="nav-fav-item" data-fav-store="${safe}"><span><strong>${safe}</strong><span class="nav-item-sub">${esc(s.category||"")}</span></span><span>›</span></button>`;
    }).join("") : "";
    const routeHtml=routeList.length ? `<div class="nav-fav-section-title">チャージルート</div>` + routeList.map(r=>{
      const safe=esc(r.name);
      return `<button type="button" class="nav-fav-item" data-fav-route="${safe}"><span><strong>${safe}</strong><span class="nav-item-sub">${esc(routeTotalLabel(r)||"")}・チャージルート</span></span><span>›</span></button>`;
    }).join("") : "";
    const overlay=openSheet("お気に入り", storeHtml + routeHtml);
    overlay.querySelectorAll("[data-fav-store]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const name=btn.dataset.favStore;
        closeSheet();
        activateMode("stores","answerBox");
        const sel=document.getElementById("answerStore");
        if(sel){
          const opt=[...sel.options].find(o=>o.value===name);
          if(opt){ sel.value=name; sel.dispatchEvent(new Event("change",{bubbles:true})); }
        }
      });
    });
    overlay.querySelectorAll("[data-fav-route]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const name=btn.dataset.favRoute;
        closeSheet();
        routeFilter="all";
        activateMode("routes");
        requestAnimationFrame(()=>{
          const el=document.querySelector(`[data-route-name=\"${CSS.escape(name)}\"]`);
          if(el) el.scrollIntoView({behavior:"smooth",block:"center"});
        });
      });
    });
  }

  function showGuide(){
    const html=`
      <p class="nav-sheet-desc">ペイ択では、目的に合わせて下のモードから支払い方法を探せます。</p>
      <button type="button" class="nav-guide-item" data-guide-mode="stores"><span><strong>お店から探す</strong><span class="nav-item-sub">店名・カテゴリから一番おトクな払い方を比較</span></span><span>›</span></button>
      <button type="button" class="nav-guide-item" data-guide-mode="campaigns"><span><strong>今月のキャンペーン</strong><span class="nav-item-sub">期間限定のキャンペーンを確認</span></span><span>›</span></button>
      <button type="button" class="nav-guide-item" data-guide-mode="cards"><span><strong>カード選び</strong><span class="nav-item-sub">質問に答えておすすめカードを確認</span></span><span>›</span></button>
      <button type="button" class="nav-guide-item" data-guide-mode="routes"><span><strong>チャージルート</strong><span class="nav-item-sub">カードから残高へ経由するルートを比較</span></span><span>›</span></button>
      <button type="button" class="nav-guide-item" data-guide-mode="invest"><span><strong>クレカ積立</strong><span class="nav-item-sub">証券会社のクレカ積立を比較</span></span><span>›</span></button>`;
    const overlay=openSheet("ペイ択ガイド", html);
    overlay.querySelectorAll("[data-guide-mode]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const mode=btn.dataset.guideMode;
        closeSheet();
        activateMode(mode);
      });
    });
  }

  nav.querySelectorAll(".bottom-nav-item").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const type=btn.dataset.nav;
      nav.querySelectorAll(".bottom-nav-item").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      if(type==="home") activateMode("stores");
      else if(type==="stores") activateMode("stores","answerBox");
      else if(type==="history") showHistory();
      else if(type==="favorites") showFavorites();
      else if(type==="guide") showGuide();
      else if(type==="articles") window.location.href="articles/";
    });
  });

  // 記事一覧ページ等からの直リンク対応（例: index.html#mode=stores）
  // ハッシュルーティング（applyRoute）とは別に、シンプルなモード起動だけを行う。
  (function(){
    const m = window.location.hash.match(/^#mode=([a-z]+)$/);
    if(!m) return;
    const mode = m[1];
    history.replaceState(null, "", window.location.pathname);
    requestAnimationFrame(()=>{ activateMode(mode); });
  })();
})();
