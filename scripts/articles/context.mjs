/**
 * 記事を書くための材料（文脈）を JSON で出す。
 *
 *   node scripts/articles/context.mjs [--keyword "表参道 髪質改善"] [--target production|mock] [--out ファイル]
 *
 * 出力:
 *   - stores     … 店舗（名前・エリア・写真）
 *   - stylists   … 掲載中の美容師（強み・得意メニュー・予約可能メニュー・料金・所属店舗）
 *                  ※ 記事に書いてよいのは、ここに出ている＝サイトで公開済みの情報だけ
 *   - articles   … 既存の記事（公開・下書きとも）
 *   - candidates … キーワード候補（状態つき）。同じキーワードで書かないための確認用
 *   - taxonomy   … メニュー・強みの一覧（キーワードの種）
 *   - keywordCheck … --keyword を渡したとき、既存の記事・候補との重なり
 */
import fs from "node:fs";
import { buildContext, keywordOverlap, listCandidates, loadDb, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));

async function main() {
  const db = loadDb(args.target ?? "production");
  const context = await buildContext(db);
  let candidates = [];
  try {
    candidates = await listCandidates(db);
  } catch (err) {
    // 候補テーブルが未作成でも材料は出す
    context.warnings = [`キーワード候補を取得できませんでした: ${err.message.split("\n")[0]}`];
  }
  const out = {
    ...context,
    candidates: candidates.map((c) => ({ id: c.id, keyword: c.keyword, status: c.status, suggestedTitle: c.suggestedTitle, articleId: c.articleId })),
    keywordCheck:
      typeof args.keyword === "string" && args.keyword.trim()
        ? keywordOverlap(args.keyword, context.articles, candidates)
        : null,
  };
  const json = JSON.stringify(out, null, 2);
  if (typeof args.out === "string") {
    fs.writeFileSync(args.out, json);
    console.log(`書き出しました: ${args.out}（美容師 ${context.stylists.length} 名 / 記事 ${context.articles.length} 本 / 候補 ${candidates.length} 件）`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
