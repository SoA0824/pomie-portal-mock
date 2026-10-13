/**
 * 下書きを検品する（保存はしない）。
 *
 *   node scripts/articles/check.mjs content/drafts/xxx.md [--target production|mock] [--offline]
 *
 * --offline を付けると DB に接続せず、美容師 ID・リンク先の存在確認を飛ばす。
 * 終了コード: 0 = エラーなし / 1 = エラーあり
 */
import { countChars, fetchLintContext, lintDraft, loadDb, parseArgs, printLint, readDraft } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
if (!file) {
  console.error("使い方: node scripts/articles/check.mjs content/drafts/xxx.md [--target production|mock] [--offline]");
  process.exit(2);
}

async function main() {
  const { meta, body } = readDraft(file);
  let ctx = null;
  if (!args.offline) {
    try {
      ctx = await fetchLintContext(loadDb(args.target ?? "production"));
    } catch (err) {
      console.log(`! DB に接続できないため、美容師 ID とリンク先の確認は飛ばします\n  (${err.message.split("\n")[0]})`);
    }
  }
  console.log(`検品: ${file}`);
  console.log(`  タイトル: ${meta.title ?? "(なし)"}`);
  console.log(`  キーワード: ${meta.target_keyword ?? "(なし)"} / カテゴリ: ${meta.category ?? "(なし)"} / 本文 約${countChars(body)} 文字`);
  const result = lintDraft(meta, body, ctx);
  printLint(result);
  if (result.errors.length) {
    console.log(`\nエラー ${result.errors.length} 件。修正してから保存してください。`);
    process.exit(1);
  }
  console.log(`\nエラーなし（注意 ${result.warnings.length} 件）。保存できます。`);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
