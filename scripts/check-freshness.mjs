#!/usr/bin/env node
/**
 * check-freshness.mjs
 *
 * 各記事HTML内の「確認日: YYYY-MM-DD」表記をすべて拾い、
 * 今日から指定日数（デフォルト90日）以上経過しているものを一覧表示する。
 * 還元率・キャンペーン条件は変わりやすいため、古くなった確認日を
 * 定期的に洗い出して再確認するために使う。
 *
 * 使い方:
 *   node scripts/check-freshness.mjs           # 90日基準
 *   node scripts/check-freshness.mjs 60        # 60日基準に変更
 *
 * 終了コード:
 *   常に0（ビルドを止める必要はなく、あくまで一覧表示が目的のため）。
 *   CIで「警告として表示したいが失敗はさせたくない」用途を想定。
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ARTICLES_DIR = join(ROOT, "articles");

const THRESHOLD_DAYS = parseInt(process.argv[2], 10) || 90;
const today = new Date();

function daysAgo(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function main() {
  const files = readdirSync(ARTICLES_DIR).filter(
    (f) => f.endsWith(".html") && f !== "index.html" && !f.startsWith("_")
  );

  // 「確認日: 2026-08-09」「確認日:2026-08-09」のような表記を拾う。
  // 全角コロンも許容する。
  const re = /確認日[：:]\s*(\d{4}-\d{2}-\d{2})/g;

  const stale = []; // { file, date, days }
  const freshCount = { total: 0, stale: 0 };

  for (const file of files) {
    const content = readFileSync(join(ARTICLES_DIR, file), "utf-8");
    const datesInFile = new Set();
    let m;
    while ((m = re.exec(content))) {
      datesInFile.add(m[1]);
    }
    datesInFile.forEach((date) => {
      const days = daysAgo(date);
      if (days === null) return;
      freshCount.total++;
      if (days >= THRESHOLD_DAYS) {
        freshCount.stale++;
        stale.push({ file, date, days });
      }
    });
  }

  console.log(`確認日つきの記述: ${freshCount.total}件 / うち${THRESHOLD_DAYS}日以上経過: ${freshCount.stale}件\n`);

  if (stale.length === 0) {
    console.log(`✅ ${THRESHOLD_DAYS}日を超えて古くなっている確認日はありません。`);
    return;
  }

  // 古い順に並べる（一番放置されているものを上に）
  stale.sort((a, b) => b.days - a.days);

  console.log(`⚠️  再確認をおすすめする記事・箇所：\n`);
  const byFile = {};
  stale.forEach((s) => {
    byFile[s.file] = byFile[s.file] || [];
    byFile[s.file].push(s);
  });
  Object.entries(byFile).forEach(([file, list]) => {
    console.log(`  ${file}`);
    list.forEach((s) => console.log(`    - 確認日: ${s.date}（${s.days}日経過）`));
  });
}

main();
