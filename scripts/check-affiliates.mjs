#!/usr/bin/env node
/**
 * check-affiliates.mjs
 *
 * 各記事HTML内の data-aff="キー" が、affiliates.json の links に
 * 実際に登録されているかをチェックする。
 * 未登録（＝そのCTAボタンはクリックされても収益に繋がらない）を一覧表示する。
 *
 * 使い方:
 *   node scripts/check-affiliates.mjs
 *
 * 終了コード:
 *   0 = 問題なし（全data-affがaffiliates.jsonに登録済み）
 *   1 = 未登録のdata-affが1件以上ある
 *
 * GitHub Actionsに組み込むと、記事を追加するたびに「収益に繋がっていないCTA」を
 * 自動検出できる（.github/workflows/build-articles.yml を参照）。
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ARTICLES_DIR = join(ROOT, "articles");
const AFFILIATES_JSON = join(ROOT, "affiliates.json");

function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    return fallback;
  }
}

function main() {
  const affiliates = loadJson(AFFILIATES_JSON, { links: {} });
  const knownKeys = new Set(Object.keys(affiliates.links || {}));

  const files = readdirSync(ARTICLES_DIR).filter(
    (f) => f.endsWith(".html") && f !== "index.html" && !f.startsWith("_")
  );

  const problems = []; // { file, key, href, kind }

  for (const file of files) {
    const path = join(ARTICLES_DIR, file);
    const content = readFileSync(path, "utf-8");

    // data-aff="キー" href="値" のペアを全部拾う
    const re = /<a\s+data-aff="([^"]+)"\s+href="([^"]*)"/g;
    let m;
    const seenInFile = new Set();
    while ((m = re.exec(content))) {
      const [, key, href] = m;
      if (seenInFile.has(key)) continue; // 同じ記事内の重複は1回だけ報告
      seenInFile.add(key);

      if (knownKeys.has(key)) continue; // 登録済みなら問題なし

      let kind = "未登録（affiliates.jsonにキーが無い）";
      if (href === "#" || href === "") {
        kind = "未登録・href=#（完全にダミー）";
      } else if (/trafficgate\.net|accesstrade\.net|a8\.net|admane\.jp/.test(href)) {
        kind = "未登録だがそれらしいURLが直書きされている（本物か要確認）";
      }
      problems.push({ file, key, href, kind });
    }
  }

  if (problems.length === 0) {
    console.log("✅ 全てのdata-affがaffiliates.jsonに登録されています。未収益化のCTAはありません。");
    process.exit(0);
  }

  console.log(`⚠️  未登録のアフィリエイトリンクが ${problems.length} 件見つかりました：\n`);
  const byFile = {};
  problems.forEach((p) => {
    byFile[p.file] = byFile[p.file] || [];
    byFile[p.file].push(p);
  });
  Object.entries(byFile).forEach(([file, list]) => {
    console.log(`  ${file}`);
    list.forEach((p) => {
      console.log(`    - key="${p.key}"  ${p.kind}`);
      if (p.href && p.href !== "#") console.log(`      href: ${p.href}`);
    });
  });
  console.log(`\naffiliates.json の "links" にこれらのキーを追加すると、該当記事すべてに自動反映されます。`);
  process.exit(1);
}

main();
