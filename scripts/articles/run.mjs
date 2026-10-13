/**
 * 記事の自動化（サーバー経路）の入口。GitHub Actions とローカルの両方から使う。
 *
 *   node scripts/articles/run.mjs propose [--limit 8] [--max-credits 30] [--max-seeds 4] [--seeds "a,b"] [--dry-run]
 *   node scripts/articles/run.mjs write   [--limit 2] [--candidate <候補ID>] [--dry-run]
 *   node scripts/articles/run.mjs status
 *
 * 共通: --target production|mock（既定 production）
 * 必要な環境変数: RAKKO_API_KEY（propose と、write の調査）/ ANTHROPIC_API_KEY（write と企画案）
 *
 * Claude Code からはコネクタがあるので、このスクリプトではなく
 * /propose-keywords と /write-article のスキルを使う（API キー不要）。
 */
import { loadDb, parseArgs, listCandidates } from "./lib.mjs";
import { proposeKeywords } from "./propose.mjs";
import { writeApprovedCandidates } from "./write.mjs";
import { accountInfo, rakkoAvailable } from "./rakko.mjs";
import { claudeAvailable, MODEL } from "./claude.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const num = (v, d) => (v === undefined || v === true ? d : Number(v));

function usage() {
  console.log(`使い方:
  node scripts/articles/run.mjs propose [--limit 8] [--max-credits 30] [--max-seeds 4] [--seeds "a,b"] [--dry-run]
  node scripts/articles/run.mjs write   [--limit 2] [--candidate <候補ID>] [--dry-run]
  node scripts/articles/run.mjs status
  共通: --target production|mock`);
}

async function main() {
  if (!cmd || args.help) {
    usage();
    return;
  }
  const db = loadDb(args.target ?? "production");
  console.log(`接続先: ${db.label}`);

  if (cmd === "propose") {
    const r = await proposeKeywords({
      db,
      limit: num(args.limit, 8),
      maxCredits: num(args["max-credits"], 30),
      maxSeeds: num(args["max-seeds"], 4),
      seeds: typeof args.seeds === "string" ? args.seeds.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      dryRun: Boolean(args["dry-run"]),
    });
    console.log(`\n種: ${r.seeds.join(" / ")}`);
    console.log(`提案 ${r.proposed.length} 件（除外 ${r.skippedCount} 件、消費 ${r.credits} クレジット）${args["dry-run"] ? "（--dry-run: 保存していません）" : ""}`);
    for (const c of r.proposed) {
      console.log(`  [${String(Math.round(c.score)).padStart(3)}] ${c.keyword}  検索数 ${c.search_volume ?? "?"} / 難易度 ${c.seo_difficulty ?? "?"} / ${c.intent} / 美容師 ${c.target_stylist_ids.join(",") || "なし"}`);
      console.log(`        ${c.suggested_title}`);
    }
    return;
  }

  if (cmd === "write") {
    const r = await writeApprovedCandidates({
      db,
      limit: num(args.limit, 2),
      candidateId: typeof args.candidate === "string" ? args.candidate : undefined,
      dryRun: Boolean(args["dry-run"]),
    });
    console.log(`\n記事化 ${r.written.length} 件 / 失敗 ${r.failed.length} 件`);
    if (r.failed.length && r.written.length === 0 && r.failed.length > 0) process.exit(1);
    return;
  }

  if (cmd === "status") {
    const candidates = await listCandidates(db);
    const counts = {};
    for (const c of candidates) counts[c.status] = (counts[c.status] ?? 0) + 1;
    console.log("候補:", JSON.stringify(counts));
    console.log(`Claude API: ${claudeAvailable() ? `利用可（${MODEL}）` : "未設定"}`);
    if (rakkoAvailable()) {
      try {
        const info = await accountInfo();
        console.log(`ラッコキーワード: ${info?.contract?.planName ?? "?"} / 残クレジット ${info?.credit?.balance ?? "?"}`);
      } catch (err) {
        console.log(`ラッコキーワード: 確認できませんでした（${err.message}）`);
      }
    } else {
      console.log("ラッコキーワード API: 未設定");
    }
    return;
  }

  usage();
  process.exit(2);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
