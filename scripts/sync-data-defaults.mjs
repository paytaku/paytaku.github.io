#!/usr/bin/env node
/**
 * sync-data-defaults.mjs
 *
 * stores.json / picks.json（編集モードから実際に読み書きされる「本番データ」）の内容を、
 * scripts/app.js に埋め込まれている DEFAULT_STORES / DEFAULT_PICKS（初回訪問時や
 * stores.json 取得前のフォールバック用データ）へ自動で反映する。
 *
 * これまでは、編集モードでの追加・削除が stores.json / picks.json にしか反映されず、
 * scripts/app.js 側の初期データとの間にズレが生じることが繰り返し起きていた
 * （例：ある店舗が stores.json にはあるのに app.js には無い、逆に app.js にはある
 * 常設ピックが picks.json から消えている、など）。このスクリプトは、そのズレを
 * 手作業で見つけて直す代わりに、stores.json / picks.json を「正」として
 * 機械的に app.js 側を上書きすることで、2つのデータソースが常に一致した状態を保つ。
 *
 * 使い方:
 *   node scripts/sync-data-defaults.mjs
 *
 * 実行タイミング: GitHub Actionsのワークフローで、stores.json / picks.json の
 * 変更をトリガーに自動実行される（.github/workflows/build-articles.yml 参照）。
 * 手元で編集モードから保存するだけで、この同期は自動的に走るため、
 * 普段は意識する必要はない。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APP_JS = join(ROOT, "scripts", "app.js");
const STORES_JSON = join(ROOT, "stores.json");
const PICKS_JSON = join(ROOT, "picks.json");

// scripts/app.js 内の `const NAME = [ ... ];` ブロックの範囲（開始インデックス〜終了インデックス）を、
// 波括弧の対応関係を数えて探す。JSON.stringifyしたテキストで丸ごと置き換えるための下準備。
function findArrayBlockRange(src, constName) {
  const marker = `const ${constName} = [`;
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error(`scripts/app.js の中に "${marker}" が見つかりませんでした`);
  }
  const bracketStart = src.indexOf("[", start);
  let depth = 0;
  let end = -1;
  for (let i = bracketStart; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error(`"${constName}" の配列の終わりが見つかりませんでした（波括弧の対応が崩れている可能性）`);
  }
  return { bracketStart, end };
}

function replaceArrayBlock(src, constName, newData) {
  const { bracketStart, end } = findArrayBlockRange(src, constName);
  const newJson = JSON.stringify(newData, null, 2);
  return src.slice(0, bracketStart) + newJson + src.slice(end + 1);
}

function main() {
  let src = readFileSync(APP_JS, "utf-8");

  const stores = JSON.parse(readFileSync(STORES_JSON, "utf-8"));
  if (!Array.isArray(stores)) throw new Error("stores.json must be an array");
  const picks = JSON.parse(readFileSync(PICKS_JSON, "utf-8"));
  if (!Array.isArray(picks)) throw new Error("picks.json must be an array");

  const before = src;
  src = replaceArrayBlock(src, "DEFAULT_STORES", stores);
  src = replaceArrayBlock(src, "DEFAULT_PICKS", picks);

  if (src === before) {
    console.log("変更なし：scripts/app.js のDEFAULT_STORES/DEFAULT_PICKSは既にstores.json/picks.jsonと一致しています。");
    return;
  }

  writeFileSync(APP_JS, src);
  console.log(`同期しました：DEFAULT_STORES（${stores.length}件） / DEFAULT_PICKS（${picks.length}件）`);
}

main();
