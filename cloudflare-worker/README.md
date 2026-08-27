# AI取り込み機能の中継サーバー（デプロイ手順）

「✨ リンクから取り込む」機能を動かすための中継サーバーです。
**クレジットカードの登録は一切不要です。** 使っているのは以下の2つの無料サービスだけです。

- **Cloudflare Workers**：中継サーバー本体（無料枠：1日10万リクエストまで）
- **Google Gemini API**（Google AI Studio）：AIによる読み取り（無料枠：1日1,500リクエストまで、Flashモデル）

Anthropic（Claude）のAPIキーは使いません。Anthropic APIは無料でも電話番号認証と将来的な
カード登録が必要になりますが、Google AI Studioは**Googleアカウントさえあればカード登録なしで
ずっと無料枠のまま使えます**（2026年8月時点）。

所要時間：15分程度。


## 事前に用意するもの

- Cloudflareアカウント（無料、カード不要）… https://dash.cloudflare.com/sign-up
- Googleアカウント（普段使っているGmailなどでOK、カード不要）
- Node.js がインストールされたPC（`node -v` で確認できればOK）

## 手順

### 1. Gemini APIキーを発行する（無料・カード不要）

1. https://aistudio.google.com/apikey にアクセスし、Googleアカウントでログイン
2. 「Create API key」を押す
3. 表示された `AIza...` から始まるキーをコピーして控えておく

料金プランへの加入やカード登録画面は出てきません。出てきた場合は無料枠の範囲を超えて
Vertex AI（別サービス）に誘導されている可能性があるので、AI Studio の画面に戻ってください。

### 2. このフォルダに移動する

ダウンロードしたZIPを展開し、ターミナル（コマンドプロンプト）でこのフォルダに入ります。

```bash
cd cloudflare-worker
```

### 3. Wrangler（Cloudflareのデプロイツール）でログイン

```bash
npx wrangler login
```

ブラウザが開くので、Cloudflareアカウントでログイン・許可してください（カード登録は求められません）。

### 3.5. KV Namespaceを作成する（必須）

パスワードの総当たり攻撃を防ぐためのレート制限・ロックアウト機能に使います。これを作らずに
デプロイすると、Workerがエラーを返すだけで機能しません。

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
```

実行すると次のような出力が出るので、`id = "..."` の部分をコピーします。

```
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

`wrangler.toml` の一番下にある `[[kv_namespaces]]` の `id = "ここに..."` の部分を、
コピーした実際の id に書き換えてください。

### 4. デプロイする

```bash
npx wrangler deploy
```

成功すると、最後に次のようなURLが表示されます。控えておきます。

```
https://paytaku-ai-import.あなたのアカウント名.workers.dev
```

### 5. GeminiのAPIキーをWorkerに登録する

APIキーはコードに書かず、Cloudflare側の「シークレット」として登録します。

```bash
npx wrangler secret put GEMINI_API_KEY
```

聞かれたら、手順1で控えた `AIza...` のキーを貼り付けてEnter。

### 5.5. 編集モードのパスワードハッシュをWorkerにも登録する（必須）

⚠️ この手順を飛ばすと、Workerが常に401エラーを返すようになります（誰からのリクエストも
受け付けない安全側の初期状態のため）。

`scripts/app.js` の先頭付近にある `EDITOR_PASSWORD_HASH`（64文字のハッシュ値）と
**まったく同じ値** を、Worker側にもシークレットとして登録します。

```bash
npx wrangler secret put EDITOR_PASSWORD_HASH
```

聞かれたら、`scripts/app.js` の `EDITOR_PASSWORD_HASH = "..."` の中身（64文字）をそのまま
貼り付けてEnter。編集モードのパスワードを変更したときは、`scripts/app.js` 側を書き換えるのと
セットで、この値も必ず登録し直してください。

これは「✨ リンクから取り込む」の呼び出しごとに、フロント側から送られてくる編集モードの
パスワードをWorkerがハッシュ化して照合するための仕組みです。以前はOriginヘッダーのチェック
だけで守ろうとしていましたが、Originはブラウザ以外からは自由に偽装できてしまうため、
本当の認証にはなっていませんでした。この手順により、パスワードを知らない第三者はWorkerを
直接叩けなくなります。

### 6. サイト側にURLを設定する

`scripts/app.js` の一番上のほうにある、この行を編集します。

```js
window.AI_IMPORT_ENDPOINT = ""; // ← 例: "https://paytaku-ai-import.your-name.workers.dev"
```

↓ 手順4で控えたURLを入れます。

```js
window.AI_IMPORT_ENDPOINT = "https://paytaku-ai-import.あなたのアカウント名.workers.dev";
```

保存して、いつも通りGitHubにpush（またはGitHub連携で保存）すれば完了です。

### 7. 許可するOriginを確認する

`worker.js` 冒頭の `ALLOWED_ORIGINS` に、実際に使うサイトのURLが入っているか確認してください
（独自ドメインを使っている場合はそちらも追加）。

```js
const ALLOWED_ORIGINS = [
  "https://paytaku.github.io",
  // "https://paytaku.example.com",
];
```

## この方式の仕組み（なぜ検索課金が発生しないか）

Gemini自身の「Web検索」機能（Grounding with Google Search）は無料枠でも課金が発生しやすい
仕組みになっています。そのため、この中継サーバーは次のようにしています。

1. 入力にURLが含まれていたら、**Workerがそのページを直接取得**する（サーバー側の通信なので
   ブラウザのCORS制限を受けない）
2. 取得した本文をそのままGeminiに読ませて、キャンペーン情報をJSONで抽出させる
3. Gemini自体には検索させない → 検索課金が発生しない

そのため、**URLを貼って使うのが一番正確**です。URLが無く説明文だけの場合は、Geminiが自分の
知識だけで推測して答えます（確度は自動的に「低」として扱われます）。

## 動作確認

サイトの「今月のキャンペーン」または「お店から探す」タブで「✨ リンクから取り込む」を押し、
キャンペーンの公式ページのURLを入れて「調べる」を押してください。
正しく設定されていれば、ページの内容を読み取った結果がプレビュー表示されます。

## 費用について

- Cloudflare Workers：無料枠は1日10万リクエストまで。個人サイトなら通常無料枠内に収まります。
- Google Gemini API：無料枠は1日1,500リクエストまで（Flashモデル）。個人利用なら十分すぎる量です。
  カードを登録しない限り、無料枠を超えると単にエラーになるだけで、勝手に課金されることはありません。

## セキュリティ機能について

- **パスワード連続失敗によるロックアウト**：同じIPから5回連続でパスワードを間違えると、
  15分間そのIPからのアクセスをすべて拒否します（正しいパスワードを送っても拒否されます）。
  総当たり攻撃（ブルートフォース）対策です。15分待つか、`worker.js` の
  `AUTH_FAIL_THRESHOLD` / `AUTH_LOCKOUT_SECONDS` で調整できます。
- **抽出元とURLのドメイン不一致の警告**：読み取り元ページと、AIが返した出典URLの
  ドメインが異なる場合、プレビュー画面に赤い警告バナーが表示されます。フィッシングサイト等が
  混入している可能性があるため、保存前に必ずリンク先を開いて公式サイトか確認してください
  （www.の有無だけの違いは警告されません）。

## うまくいかないとき

- 「サーバー側に RATE_LIMIT_KV が設定されていません」と出る → 手順3.5をやり直してください。
- 「サーバー側に GEMINI_API_KEY が設定されていません」と出る → 手順5をやり直してください。
- 「サーバー側に EDITOR_PASSWORD_HASH が設定されていません」と出る → 手順5.5をやり直してください。
- 「認証に失敗しました（編集モードのパスワードが違います）」と出る → 入力したパスワードが、
  `scripts/app.js` の `EDITOR_PASSWORD_HASH` に対応する平文パスワードと違います。手順5.5で
  Worker側に登録した値と、`scripts/app.js` 側の値が一致しているか確認してください。
- 「このIPからのアクセスを一時的にブロックしています」と出る → パスワードを5回連続で
  間違えたためロックアウト中です。15分待ってから再試行してください。
- 「リクエストが多すぎます」と出る → 簡易レート制限（1時間あたり20回／IP）にかかっています。
  時間を置いて再試行するか、頻繁に使う場合は `worker.js` の `RATE_LIMIT_MAX_REQUESTS` を調整してください。
- 「Gemini APIがエラーを返しました（HTTP 429）」と出る → その日の無料枠（1日1,500回）を
  使い切っています。日付が変わるまで待つか、翌日再試行してください。
- 「Gemini APIがエラーを返しました（HTTP 400）」でモデル名関連のメッセージが出る → Googleが
  モデル名を変更した可能性があります。`worker.js` の `GEMINI_MODEL` を
  https://ai.google.dev/gemini-api/docs/models で確認できる無料枠対象モデル名に変更してください。
- 何も反応がない／コンソールにCORSエラーが出る → `worker.js` の `ALLOWED_ORIGINS` に、実際に
  アクセスしているURL（`https://` から正確に）が入っているか確認してください。
- 読み取り結果の確度がいつも「低」になる → URLを入力しているか確認してください。説明文だけだと
  Geminiは実際のページを見られないため、確度は必ず低くなります。
