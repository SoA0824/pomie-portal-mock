"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { AREA_SLUGS } from "@/lib/areas";
import { ARTICLE_CATEGORIES, type ArticleCategory } from "@/lib/types";

type Result = { ok: true } | { ok: false; reason: string };

function now() {
  return new Date().toISOString();
}

function newRevisionId() {
  return `rv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function revalidateArticle(id: string, slug?: string) {
  revalidatePath(`/admin/articles/${id}/edit`);
  revalidatePath("/admin/articles");
  if (slug) {
    revalidatePath(`/articles/${slug}`);
    revalidatePath("/articles");
    for (const a of AREA_SLUGS) revalidatePath(`/articles/${a}`);
    revalidatePath("/sitemap.xml");
  }
}

/**
 * リライトを依頼する（管理画面）。
 * 依頼は「依頼済み」として保存され、Claude Code の /rewrite-article で提案が作られる。
 */
export async function requestRewrite(input: {
  articleId: string;
  instruction: string;
  removeStylistIds?: string[];
  addStylistIds?: string[];
}): Promise<Result> {
  const instruction = input.instruction.trim();
  const remove = Array.from(new Set(input.removeStylistIds ?? [])).filter(Boolean);
  const add = Array.from(new Set(input.addStylistIds ?? [])).filter(Boolean);
  if (!instruction && remove.length === 0 && add.length === 0) {
    return { ok: false, reason: "リライトの指示か、美容師の差し替えを入力してください" };
  }
  const sb = getSupabase();
  const { data: article, error: aErr } = await sb.from("articles").select("id").eq("id", input.articleId).maybeSingle();
  if (aErr) return { ok: false, reason: aErr.message };
  if (!article) return { ok: false, reason: "記事が見つかりません" };

  const { error } = await sb.from("article_revisions").insert({
    id: newRevisionId(),
    article_id: input.articleId,
    status: "requested",
    instruction,
    stylist_swap: { remove, add },
  });
  if (error) return { ok: false, reason: error.message };
  revalidateArticle(input.articleId);
  return { ok: true };
}

/**
 * 提案を記事に反映する（管理画面の「承認して反映」）。
 * - URL（slug）・公開状態・公開日時は変えない
 * - 提案を作った後に記事が手で編集されていたら、上書きしてよいか確認する（force で反映）
 */
export async function applyRevision(
  revisionId: string,
  { force = false }: { force?: boolean } = {}
): Promise<Result | { ok: false; reason: "conflict"; message: string }> {
  const sb = getSupabase();
  const { data: rev, error: rErr } = await sb.from("article_revisions").select("*").eq("id", revisionId).maybeSingle();
  if (rErr) return { ok: false, reason: rErr.message };
  if (!rev) return { ok: false, reason: "リライト案が見つかりません" };
  if (rev.status !== "proposed") return { ok: false, reason: "承認待ちのリライト案ではありません" };
  if (!rev.proposed_body?.trim() || !rev.proposed_title?.trim()) {
    return { ok: false, reason: "リライト案の本文かタイトルが空です" };
  }

  const { data: article, error: aErr } = await sb
    .from("articles")
    .select("id, slug, status, updated_at")
    .eq("id", rev.article_id)
    .maybeSingle();
  if (aErr) return { ok: false, reason: aErr.message };
  if (!article) return { ok: false, reason: "記事が見つかりません（削除された可能性があります）" };

  if (!force && rev.base_updated_at && new Date(article.updated_at).getTime() > new Date(rev.base_updated_at).getTime() + 1000) {
    return {
      ok: false,
      reason: "conflict",
      message: "このリライト案を作った後に、記事が編集されています。反映すると、その編集内容は上書きされます。",
    };
  }

  const category = ARTICLE_CATEGORIES.includes(rev.proposed_category as ArticleCategory) ? rev.proposed_category : undefined;
  const patch: Record<string, unknown> = {
    title: rev.proposed_title.trim(),
    summary: (rev.proposed_summary ?? "").trim(),
    body: rev.proposed_body,
    updated_at: now(),
    ...(category ? { category } : {}),
    ...(rev.proposed_related_stylist_ids ? { related_stylist_ids: rev.proposed_related_stylist_ids } : {}),
    ...(rev.proposed_areas ? { areas: rev.proposed_areas.filter((a: string) => AREA_SLUGS.includes(a)) } : {}),
  };
  const { error: uErr } = await sb.from("articles").update(patch).eq("id", article.id);
  if (uErr) return { ok: false, reason: uErr.message };

  await sb.from("article_revisions").update({ status: "applied", decided_at: now(), updated_at: now() }).eq("id", revisionId);
  // 同じ記事の他の承認待ちの案は、元の記事が変わったので古い案として残す（必要なら作り直す）
  revalidateArticle(article.id, article.slug);
  return { ok: true };
}

export async function rejectRevision(revisionId: string): Promise<Result> {
  const sb = getSupabase();
  const { data: rev, error: rErr } = await sb
    .from("article_revisions")
    .select("article_id, status")
    .eq("id", revisionId)
    .maybeSingle();
  if (rErr) return { ok: false, reason: rErr.message };
  if (!rev) return { ok: false, reason: "リライト案が見つかりません" };
  if (rev.status === "applied") return { ok: false, reason: "反映済みのリライトは取り消せません" };
  const { error } = await sb
    .from("article_revisions")
    .update({ status: "rejected", decided_at: now(), updated_at: now() })
    .eq("id", revisionId);
  if (error) return { ok: false, reason: error.message };
  revalidateArticle(rev.article_id);
  return { ok: true };
}
