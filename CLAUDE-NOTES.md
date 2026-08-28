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
`content/articles.json`（実際にこのファイルの中身を変更した時だけ送る。新規記事の登録、`updatedDate`・`tags`・`related`・`customHtml`フラグなどを変えた場合が対象。記事HTMLの本文だけ直してこのファイルに触れていない場合は送らなくてよい）/ `articles/{slug}.html`（customHtml:trueのもの）/ `affiliates.json` / `assets/affiliates.js` / `admin/affiliates.html` / `scripts/build-articles.mjs`（変更した場合のみ）。

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

## 4. アフィリエイト表示の仕組み（2026-08-28追加）

`assets/affiliates.js` に、記事側のHTMLを毎回編集しなくていいように次の3つの自動表示ディレクティブを追加した。新しい記事を書くときはこれらを使うこと（`data-aff-banner-list`の全部並べ表示は非推奨。連続表示になって見た目が悪いため）。

- **`data-aff-hero="キー"`**：記事冒頭で券面画像を「名前・訴求コピー・CTA」とセットで大きく見せるヒーローカード。HTML側は `.lp-hero-card` の型を `articles/rakuten-card-review.html` からコピーして使う。券面バナー（banners配列の1枚目）が未登録なら自動で非表示になる。
- **`data-aff-banner-slot="キー"`**：章の切れ目（`</section>`の直後など）に置いておくだけの空枠。同じキーで複数箇所に置くと、admin側で登録したバナー枚数に応じて自動的に均等な間隔で振り分けられる（バナーが1〜2枚しかなければ連続せず離れた位置に1回だけ出る）。**バナー枚数を増減しても記事HTML側の編集は不要**——枠だけ多めに置いておけばよい。`articles/dmm-kabu-shindan.html` が実例。
- **`data-aff-random-slot`**（任意で`data-aff-random-category="app"`）：クレカ以外の案件（アプリ案件など）をランダムに1つ差し込む枠。admin側でカードの「案件ジャンル」を「アプリ案件」または「その他」に設定した案件だけが候補になる。対象が無ければ自動で非表示。

admin側（`admin/affiliates.html`）には各カードに「案件ジャンル」セレクトを追加済み（空欄＝通常のクレカ、`app`＝アプリ案件、`other`＝その他）。クレカ以外の案件を登録するときは、ここを必ずアプリ案件かその他に変更すること（デフォルトのままだとクレカ扱いになり、ランダム枠の対象にならない）。

## 5. サムネイル自動生成について（2026-08-28検討・未実装）

現状はLovart（lovart.ai）に記事タイトルを手入力してサムネイルを都度生成しており、これを「sitemap.xml更新時に自動生成」「チェックした記事だけ自動生成」にできないか検討した。結論：**Lovartには公開APIが無く、外部から自動呼び出しはできない**。自動化するなら、GitHub Actionsの`build-articles.yml`実行後に以下のようなワークフローを追加する方向性になる（未実装）：
1. `content/articles.json` を走査し、`thumbnail`未設定 かつ `assets/thumbnails/{slug}.*` が存在しない記事、または `articles.json` 側に `generateThumbnail:true` フラグが立っている記事を抽出。
2. それらの記事タイトル・overviewを画像生成API（OpenAIのgpt-image-1、Google Gemini（Imagen）など、公開APIがあるもの）に渡してサムネイルを生成。
3. `assets/thumbnails/{slug}.png` として保存し、自動コミット。
実装する場合はどの画像生成APIを使うか（費用・商用利用条件を含む）を先に決める必要がある。

## 6. ビルドスクリプトの実行
記事一覧・sitemap・健全性チェックを手元で確認したい場合は以下を実行（通常はGitHub Actionsが自動実行するので必須ではない）：
```
node scripts/build-articles.mjs
```
