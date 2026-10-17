/**
 * 記事のリライト（コネクタ経路 = Claude Code の /rewrite-article から使う）。
 *
 *   node scripts/articles/rewrite.mjs list
 *       … 依頼済み（リライト待ち）の一覧
 *   node scripts/articles/rewrite.mjs request --article <slug|id> --instruction "..." [--remove st-a,st-b] [--add st-c]
 *       … チャットからリライトを依頼する（管理画面からの依頼と同じ扱い）
 *   node scripts/articles/rewrite.mjs analyze <slug|id> [--gsc queries.csv] [--json]
 *       … 記事の状況を分析する（保存はしない）
 *   node scripts/articles/rewrite.mjs context <依頼ID> [--gsc queries.csv] [--out ディレクトリ]
 *       … リライトの材料（依頼・記事・分析・美容師）を JSON で出し、今の記事を編集用の
 *         Markdown（content/rewrites/<slug>.md）に書き出す
 *   node scripts/articles/rewrite.mjs save <依頼ID> --file content/rewrites/<slug>.md --analysis "..." --summary "..."
 *       … 検品して「提案あり」として保存（管理画面で承認すると記事に反映）
 *       （長い文章は --analysis-file / --summary-file でファイルから渡せる）
 *   node scripts/articles/rewrite.mjs fail <依頼ID> --reason "..."
 *
 * 共通: --target production|mock
 * --gsc には Search Console の「検索パフォーマンス → クエリ」を書き出した CSV を渡せる。
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, SITE_URL, loadDb, newId, parseArgs, printLint, readDraft, rest } from "./lib.mjs";
import { analyzeArticle, buildRewriteContext, getArticle, getRevision, patchRevision, printAnalysis, saveRewriteProposal } from "./rewriteLib.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const REWRITES_DIR = path.join(ROOT, "content", "rewrites");

async function main() {
  const db = loadDb(args.target ?? "production");

  if (cmd === "list") {
    const revs = await rest(db, "GET", "article_revisions?select=*&status=eq.requested&order=requested_at");
    if (!revs.length) {
      console.log("リライト待ちの依頼はありません");
      return;
    }
    for (const r of revs) {
      const a = await getArticle(db, r.article_id).catch(() => null);
      console.log(`${r.id}  ${a ? a.title : "(記事なし)"}  /articles/${a?.slug ?? "-"}`);
      if (r.instruction) console.log(`    指示: ${r.instruction.replace(/\n/g, " / ")}`);
      const sw = r.stylist_swap ?? {};
      if ((sw.remove ?? []).length || (sw.add ?? []).length) console.log(`    美容師: 外す ${(sw.remove ?? []).join(",") || "-"} / 加える ${(sw.add ?? []).join(",") || "-"}`);
    }
    return;
  }

  if (cmd === "request") {
    if (typeof args.article !== "string") throw new Error("--article に記事の slug か ID を指定してください");
    const article = await getArticle(db, args.article);
    const csv = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
    const instruction = typeof args.instruction === "string" ? args.instruction : "";
    const swap = { remove: csv(args.remove), add: csv(args.add) };
    if (!instruction && !swap.remove.length && !swap.add.length) throw new Error("--instruction か --remove / --add を指定してください");
    const id = newId("rv");
    await rest(db, "POST", "article_revisions", {
      body: { id, article_id: article.id, status: "requested", instruction, stylist_swap: swap },
      prefer: "return=minimal",
    });
    console.log(`リライトを依頼しました: ${id}（${article.title}）`);
    return;
  }

  if (cmd === "analyze") {
    const article = await getArticle(db, args._[1] ?? "");
    const a = await analyzeArticle(db, article, { gscFile: typeof args.gsc === "string" ? args.gsc : undefined });
    if (args.json) console.log(JSON.stringify(a, null, 2));
    else printAnalysis(a);
    return;
  }

  if (cmd === "context") {
    const rev = await getRevision(db, args._[1] ?? "");
    if (rev.status !== "requested" && !args.force) throw new Error(`この依頼は状態が ${rev.status} です（作り直すなら --force）`);
    const article = await getArticle(db, rev.article_id);
    const { out, analysis, nextRelated, draft } = await buildRewriteContext(db, rev, article, { gscFile: typeof args.gsc === "string" ? args.gsc : undefined });
    const outDir = typeof args.out === "string" ? args.out : "/tmp";
    fs.mkdirSync(outDir, { recursive: true });
    const jsonFile = path.join(outDir, `pomie-rewrite-${rev.id}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(out, null, 2));
    fs.mkdirSync(REWRITES_DIR, { recursive: true });
    const draftFile = path.join(REWRITES_DIR, `${article.slug}.md`);
    fs.writeFileSync(draftFile, draft);
    console.log(`材料: ${jsonFile}`);
    console.log(`編集用の下書き: ${path.relative(process.cwd(), draftFile)}（今の記事。紹介する美容師は差し替え後の値: ${nextRelated.join(", ") || "なし"}）`);
    printAnalysis(analysis);
    return;
  }

  if (cmd === "save") {
    const rev = await getRevision(db, args._[1] ?? "");
    if (!["requested", "failed"].includes(rev.status) && !args.force) throw new Error(`この依頼は状態が ${rev.status} です（上書きするなら --force）`);
    if (typeof args.file !== "string") throw new Error("--file にリライトした Markdown を指定してください");
    const article = await getArticle(db, rev.article_id);
    const { meta, body } = readDraft(args.file);
    const readText = (inline, file) => (typeof file === "string" ? fs.readFileSync(file, "utf8").trim() : typeof inline === "string" ? inline.trim() : "");
    const analysis = readText(args.analysis, args["analysis-file"]);
    const summary = readText(args.summary, args["summary-file"]);
    if (!summary) throw new Error("--summary（変更点の要約）を指定してください。管理画面で承認の判断に使います");
    const r = await saveRewriteProposal(db, rev, article, { meta, body, analysis, summary });
    console.log(`検品: ${args.file}`);
    printLint(r.lint);
    if (!r.ok) {
      console.log(`\nエラー ${r.lint.errors.length} 件のため保存しませんでした。`);
      process.exit(1);
    }
    console.log(`\nリライト案を保存しました（承認待ち）: ${article.title}`);
    console.log(`  確認・承認: ${SITE_URL}/admin/articles/${article.id}/edit`);
    return;
  }

  if (cmd === "fail") {
    const rev = await getRevision(db, args._[1] ?? "");
    await patchRevision(db, rev.id, { status: "failed", error: typeof args.reason === "string" ? args.reason : "リライトに失敗しました" });
    console.log("失敗として記録しました");
    return;
  }

  console.log("使い方は scripts/articles/rewrite.mjs の先頭を参照してください（list / request / analyze / context / save / fail）");
  process.exit(2);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
