/**
 * ジョブの実行（GitHub Actions とローカルの両方から使う）。
 *
 *   node scripts/jobs/run.mjs [run] [--max 5] [--minutes 25]
 *       … 待ちジョブを古い順に実行する（件数か時間の上限まで）
 *   node scripts/jobs/run.mjs enqueue <propose|write|rewrite|social|social_images> [--target <ID>] [--limit n]
 *       … ジョブを積む（スケジュールや手動で）
 *   node scripts/jobs/run.mjs list
 *       … 最近のジョブ
 *
 * 共通: --target-db production|mock
 * 必要な環境変数: ANTHROPIC_API_KEY（執筆・リライト・SNS）/ RAKKO_API_KEY（提案）/ GEMINI_API_KEY（SNS の画像）
 */
import { loadDb, parseArgs, rest } from "../articles/lib.mjs";
import { KINDS, KIND_LABEL, claimNext, enqueue, finish, makeLogger, recoverStale, runnerName } from "./lib.mjs";
import { handlers } from "./handlers.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] ?? "run";
const num = (v, d) => (v === undefined || v === true ? d : Number(v));

async function main() {
  const db = loadDb(typeof args["target-db"] === "string" ? args["target-db"] : "production");

  if (cmd === "enqueue") {
    const kind = args._[1];
    const params = {};
    if (args.limit !== undefined) params.limit = num(args.limit, undefined);
    if (args.slide !== undefined) params.slide = num(args.slide, undefined);
    const r = await enqueue(db, { kind, targetId: typeof args.target === "string" ? args.target : null, params, requestedBy: process.env.GITHUB_RUN_ID ? "schedule" : "cli" });
    console.log(r.existing ? `同じ対象のジョブが既にあります: ${r.id}（${r.status}）` : `ジョブを積みました: ${r.id}（${KIND_LABEL[kind]}）`);
    return;
  }

  if (cmd === "list") {
    const jobs = await rest(db, "GET", "jobs?select=id,kind,status,target_id,created_at,finished_at,error&order=created_at.desc&limit=20");
    for (const j of jobs) console.log(`${j.created_at.slice(0, 16)}  ${j.status.padEnd(8)}  ${KIND_LABEL[j.kind] ?? j.kind}  ${j.target_id ?? ""}  ${j.error ? `✗ ${j.error.slice(0, 80)}` : ""}`);
    if (!jobs.length) console.log("ジョブはありません");
    return;
  }

  if (cmd === "run") {
    const max = num(args.max, 5);
    const minutes = num(args.minutes, 25);
    const deadline = Date.now() + minutes * 60000;
    const runner = runnerName();
    const recovered = await recoverStale(db);
    if (recovered) console.log(`止まっていたジョブを ${recovered} 件戻しました`);

    let done = 0;
    let failed = 0;
    for (let i = 0; i < max && Date.now() < deadline; i++) {
      const job = await claimNext(db, runner);
      if (!job) break;
      const { log, text } = makeLogger();
      const started = Date.now();
      console.log(`\n=== ${KIND_LABEL[job.kind] ?? job.kind} ${job.id}${job.target_id ? ` → ${job.target_id}` : ""}（${job.attempts} 回目）`);
      try {
        const handler = handlers[job.kind];
        if (!handler) throw new Error(`未対応のジョブの種類です: ${job.kind}`);
        const result = await handler(db, job, log);
        await finish(db, job.id, { status: "done", result: { ...result, seconds: Math.round((Date.now() - started) / 1000) }, log: text() });
        done++;
        console.log(`完了（${Math.round((Date.now() - started) / 1000)} 秒）`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`失敗: ${message}`);
        await finish(db, job.id, { status: "failed", error: message.slice(0, 1000), log: text() });
        failed++;
      }
    }
    console.log(`\n完了 ${done} 件 / 失敗 ${failed} 件${done + failed === 0 ? "（待ちジョブはありませんでした）" : ""}`);
    return;
  }

  console.log(`使い方: node scripts/jobs/run.mjs [run|enqueue <${KINDS.join("|")}>|list]`);
  process.exit(2);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
