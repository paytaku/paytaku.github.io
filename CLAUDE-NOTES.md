# Claude作業メモ（新しいチャットでは必ず最初に確認）

このファイルは、ペイ択サイトの改修をClaudeに依頼するときのための引き継ぎメモです。
チャットが変わってもこのリポジトリ（zip）の中に残るので、次回作業する際は必ず目を通してください。

---

## 1. 自動生成ファイルの扱い（コスト削減のポイント）

このリポジトリは、GitHub Actions（`.github/workflows/build-articles.yml`）が
`content/articles.json` / `articles/**` / `scripts/**` / `affiliates.json` の変更をmainにpushするたびに検知し、
`node scripts/build-articles.mjs` を自動実行して以下のファイルを**自動生成・自動コミット**します。

- `articles/index.html`（記事一覧ページ）
- `sitemap.xml`
- `content/health-check.json`（内部リンク切れ・未収益化リンク・確認日の鮮度チェック結果）
- `content/aff-keys.json`（記事内で使われている data-aff キー一覧）
- `customHtml: false` の記事の `articles/{slug}.html`（テンプレートから自動生成される記事のみ）

**ルール：**
- **zipにまとめて渡すときは、上記の自動生成ファイルも含めて必ずフルセットで渡す。**（`node scripts/build-articles.mjs` を実行してから固める。ユーザーが差し替えるだけで完結するようにするため）
- ただし、チャット本文でこれらのファイルを1つずつ個別に列挙したり、内容を逐一説明したりする必要はない（トークンの無駄になるため）。「ビルドし直して同梱しました」の一言で十分。
- 個別に`present_files`で1ファイルずつ提示する必要もない。zip 1つにまとめて渡せばよい。

**必ず人間・Claudeが直接編集するソース（zipに含めるのは当然として、変更差分として意識すべきもの）：**
`content/articles.json` / `articles/{slug}.html`（customHtml:trueのもの）/ `affiliates.json` / `assets/affiliates.js` / `admin/affiliates.html` / `scripts/build-articles.mjs`（変更した場合のみ）。

### aff-keys.json だけでは防ぎきれない点（重要）
`content/aff-keys.json`（記事内の実際のdata-affキー一覧）は自動検出の土台にはなるが、単体では下記2点を防げない。実際に一度、この事故が発生している（コスモ・ザ・カード・オーパス：記事は`cosmo-the-card-opus`キーを使用、管理画面には別キー`kosumo-za-kaado-oopasu`で登録され、リンクが繋がっていなかった）。

1. **名前の重複はチェックされない**：管理画面の「カードを追加」はキーの重複しか見ておらず、同じ商品名を手入力すると別キーで二重登録できてしまう。→ `admin/affiliates.html`の`addCardConfirm`に、名前が既存カードと一致する場合に警告するチェックを追加済み（2026-08-27）。
2. **aff-keys.jsonは直近のビルド時点の情報でしかない**：記事を書いた直後、ビルド前に管理画面でカードを手動追加すると、まだ検出されていないので事故が起きうる。→ 「カードを追加」ボタンを押した瞬間に`aff-keys.json`を再取得する処理を追加済み（2026-08-27）。

新しいアフィリエイト案件を追加するときは、まず記事側の`data-aff`キーを先に決めてから、管理画面でその名前を入力し、上記の警告が出ないか確認すること。

### 事故防止：customHtml:false の記事は直接HTML編集しない
`customHtml:false`（未設定含む）の記事HTMLは、次に `node scripts/build-articles.mjs` が走った瞬間に `content/articles.json` のデータから機械的に再生成され、**手で加えた編集は問答無用で消える**（実際に一度、この事故が発生している）。
- テンプレート生成される記事の内容を直す場合は、必ず `content/articles.json` 側のフィールド（steps / note / ctaUrl など）を編集すること。HTMLファイルを直接触らない。
- 1つのキャンペーンに複数カード・複数商品の手順を混在させると、テンプレートが「1つの連続した手順」として不自然に描画してしまう（実際に発生した事例：JCBと三井住友カードが1本のstepsに混在し、③がいきなり別カードの話になっていた）。複数商品にまたがる内容は、素直に `customHtml: true` に切り替えて手書きHTMLにすること。
- 2026-08-27時点で `customHtml:false` のまま残っている記事：`vpoint-pay-yusen-10` / `vcoupon-multi-shop-500pt` / `natsu-coupon-matsuri` / `jichitai-campaign` / `dpoint-koukan-zouryo`。実際にビルドし直して現行ファイルと差分比較済みで、手作業の追記は入っておらず現時点で安全。ただし今後これらに手を入れる際は、上記の通りJSON側を編集すること。

---

## 2. 納品形式の基準（zip vs ファイル単体）

- **編集ファイルが10前後（目安：8〜10以上）になる場合 → zip**（フルセット、上記1のルールどおり）
- **編集ファイルが数個（目安：1〜5個程度）の場合 → zipにせず、ファイル単体でそのまま渡す**

ファイル単体の方がトークン・クレジットの消費が少ないため、少数ファイルの修正時にzip化するのは無駄になる。逆に10ファイル前後になると個別に貼るより1つのzipにまとめた方が扱いやすく、結果的にコストも下がる。迷ったら「まとめる手間・展開する手間に見合うファイル数か」で判断すること。

---

## 3. このサイトについて
- クレジットカード・スマホ決済・ポイントサイトなどの比較・アフィリエイトサイト（GitHub Pages: `paytaku.github.io`）
- 新しい記事を書く際は、`paytaku-article-strategy` スキル（独り言リサーチ→競合の穴→見出し構成の3ステップ）を使うこと
- アフィリエイトリンクは `affiliates.json` で一元管理。記事側は `data-aff="キー"` を書くだけで `assets/affiliates.js` が自動的にリンク・文言・バナーを差し込む
- ポイントサイト（ハピタス・モッピー・ポイントインカムなど）は `isPointSite:true` で管理。`data-aff-pointsites-list` を記事に置くだけで、`affiliates.json` に登録済みの全ポイントサイトが自動一覧表示される（新しいポイントサイトを追加しても記事側の編集は不要）

## 4. ビルドスクリプトの実行
記事一覧・sitemap・健全性チェックを手元で確認したい場合は以下を実行（通常はGitHub Actionsが自動実行するので必須ではない）：
```
node scripts/build-articles.mjs
```
