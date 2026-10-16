/**
 * 下書きを DB に「下書き（非公開）」として保存する。
 *
 *   node scripts/articles/save.mjs content/drafts/xxx.md [--target production|mock] [--force] [--dry-run] [--candidate <候補ID>]
 *
 * --candidate を付けると、そのキーワード候補と記事を紐づけ、候補を「記事化済み」にする。
 *
 * 安全のためのルール:
 *   - 保存される記事は必ず status = draft（公開は管理画面で人が行う）
 *   - 同じ slug の記事が既にある場合:
 *       下書き … --force を付けたときだけ上書き
 *       公開中 … 上書きしない（公開中の記事は管理画面で編集する）
 *   - 検品でエラーがあれば保存しない
 */
import { AREAS, SITE_URL, deriveAreas, fetchLintContext, getCandidate, lintDraft, loadDb, parseArgs, printLint, readDraft, rest, updateCandidate } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
if (!file) {
  console.error("使い方: node scripts/articles/save.mjs content/drafts/xxx.md [--target production|mock] [--force] [--dry-run]");
  process.exit(2);
}

function newArticleId() {
  return `ar-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** フロントマターの areas（slug または地名）を優先し、無ければキーワード・美容師から推定 */
function resolveAreas(meta, ctx) {
  const raw = Array.isArray(meta.areas) ? meta.areas : typeof meta.areas === "string" && meta.areas ? meta.areas.split(/[,\s]+/) : [];
  const explicit = raw
    .map((v) => AREAS.find((a) => a.slug === v || a.name === v)?.slug)
    .filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];
  const stylistStoreIds = (meta.related_stylist_ids ?? []).map((id) => ctx.stylists.get(id)?.storeId).filter(Boolean);
  return deriveAreas({ keyword: meta.target_keyword, title: meta.title, stylistStoreIds });
}

async function main() {
  const { meta, body } = readDraft(file);
  const db = loadDb(args.target ?? "production");
  console.log(`接続先: ${db.label}`);

  const ctx = await fetchLintContext(db);

  // 承認済みの候補から書いた場合は、候補と紐づける
  let candidate = null;
  if (typeof args.candidate === "string") {
    candidate = await getCandidate(db, args.candidate);
    if (!candidate) {
      console.log(`候補が見つかりません: ${args.candidate}`);
      process.exit(1);
    }
    if (candidate.status === "written" && candidate.articleId && !args.force) {
      console.log(`候補「${candidate.keyword}」は既に記事化済みです（${candidate.articleId}）。上書きするには --force`);
      process.exit(1);
    }
  }
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
    areas: resolveAreas(meta, ctx),
    published_at: null,
    ...(candidate ? { keyword_candidate_id: candidate.id } : {}),
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
  if (candidate) {
    await updateCandidate(db, candidate.id, {
      status: "written",
      article_id: id,
      written_at: new Date().toISOString(),
      error: null,
    });
    console.log(`  候補「${candidate.keyword}」を記事化済みにしました`);
  }
  console.log(`  id: ${id} / slug: ${slug} / エリア: ${row.areas.join(", ") || "なし"}`);
  console.log(`  プレビュー: ${SITE_URL}/admin/articles/${id}/preview`);
  console.log(`  編集・公開: ${SITE_URL}/admin/articles/${id}/edit`);
  console.log(`  ※ 公開は管理画面で内容を確認してから行ってください`);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
