/**
 * 下書きを DB に「下書き（非公開）」として保存する。
 *
 *   node scripts/articles/save.mjs content/drafts/xxx.md [--target production|mock] [--force] [--dry-run]
 *
 * 安全のためのルール:
 *   - 保存される記事は必ず status = draft（公開は管理画面で人が行う）
 *   - 同じ slug の記事が既にある場合:
 *       下書き … --force を付けたときだけ上書き
 *       公開中 … 上書きしない（公開中の記事は管理画面で編集する）
 *   - 検品でエラーがあれば保存しない
 */
import { SITE_URL, fetchLintContext, lintDraft, loadDb, parseArgs, printLint, readDraft, rest } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
if (!file) {
  console.error("使い方: node scripts/articles/save.mjs content/drafts/xxx.md [--target production|mock] [--force] [--dry-run]");
  process.exit(2);
}

function newArticleId() {
  return `ar-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function main() {
  const { meta, body } = readDraft(file);
  const db = loadDb(args.target ?? "production");
  console.log(`接続先: ${db.label}`);

  const ctx = await fetchLintContext(db);
  console.log(`検品: ${file}`);
  const result = lintDraft(meta, body, ctx);
  printLint(result);
  if (result.errors.length) {
    console.log(`\nエラー ${result.errors.length} 件のため保存しませんでした。`);
    process.exit(1);
  }

  const slug = String(meta.slug).trim().toLowerCase();
  const existing = ctx.articles.get(slug) ?? null;
  if (existing && existing.status === "published") {
    console.log(`\n「${slug}」は公開中の記事です。安全のため上書きしません。`);
    console.log(`  内容を変えたい場合は管理画面で編集するか、別の slug で保存してください。`);
    console.log(`  編集: ${SITE_URL}/admin/articles/${existing.id}/edit`);
    process.exit(1);
  }
  if (existing && !args.force) {
    console.log(`\n「${slug}」は既に下書きとして保存されています。上書きするには --force を付けてください。`);
    console.log(`  編集: ${SITE_URL}/admin/articles/${existing.id}/edit`);
    process.exit(1);
  }

  const row = {
    slug,
    title: String(meta.title).trim(),
    summary: String(meta.summary ?? "").trim(),
    body,
    category: meta.category,
    cover_image: String(meta.cover_image ?? "").trim(),
    related_stylist_ids: [...new Set(meta.related_stylist_ids ?? [])],
    status: "draft",
    source: "ai",
    target_keyword: String(meta.target_keyword ?? "").trim() || null,
    published_at: null,
    updated_at: new Date().toISOString(),
  };

  if (args["dry-run"]) {
    console.log("\n--dry-run のため保存しません。送信内容:");
    console.log(JSON.stringify({ ...row, body: `(${body.length} 文字)` }, null, 2));
    return;
  }

  let id;
  if (existing) {
    id = existing.id;
    await rest(db, "PATCH", `articles?id=eq.${encodeURIComponent(id)}`, { body: row, prefer: "return=minimal" });
    console.log(`\n上書き保存しました（下書き）: ${row.title}`);
  } else {
    id = newArticleId();
    await rest(db, "POST", "articles", { body: { id, ...row }, prefer: "return=minimal" });
    console.log(`\n保存しました（下書き）: ${row.title}`);
  }
  console.log(`  id: ${id} / slug: ${slug}`);
  console.log(`  プレビュー: ${SITE_URL}/admin/articles/${id}/preview`);
  console.log(`  編集・公開: ${SITE_URL}/admin/articles/${id}/edit`);
  console.log(`  ※ 公開は管理画面で内容を確認してから行ってください`);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
