"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { deleteStorageObjectByUrl } from "@/lib/storage";
import { ARTICLE_CATEGORIES, type SaveArticleInput } from "@/lib/types";

export type SaveArticleResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; reason: string };

/** URL に使う文字列: 半角英小文字・数字・ハイフンのみ */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function newArticleId(): string {
  return `ar-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function revalidateArticlePages(slugs: string[]) {
  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
  revalidatePath("/admin/articles");
  for (const slug of slugs) revalidatePath(`/articles/${slug}`);
}

/**
 * 記事の作成・更新。
 * 公開にする場合は本文と概要を必須にする（中身のない記事を公開しないため）。
 */
export async function saveArticle(input: SaveArticleInput): Promise<SaveArticleResult> {
  const title = input.title.trim();
  const slug = input.slug.trim().toLowerCase();
  const summary = input.summary.trim();
  const body = input.body.trim();

  if (!title) return { ok: false, reason: "missing_title" };
  if (!SLUG_PATTERN.test(slug)) return { ok: false, reason: "invalid_slug" };
  if (!ARTICLE_CATEGORIES.includes(input.category)) return { ok: false, reason: "invalid_category" };
  if (input.status === "published") {
    if (!summary) return { ok: false, reason: "missing_summary_for_publish" };
    if (!body) return { ok: false, reason: "missing_body_for_publish" };
  }

  const sb = getSupabase();

  // slug の重複チェック（自分自身は除く）
  const { data: sameSlug, error: slugErr } = await sb
    .from("articles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugErr) return { ok: false, reason: slugErr.message };
  if (sameSlug && sameSlug.id !== input.id) return { ok: false, reason: "duplicate_slug" };

  // 既存記事（更新時）: 旧 slug・旧カバー画像・公開日時の引き継ぎに使う
  let existing: { slug: string; cover_image: string; published_at: string | null } | null = null;
  if (input.id) {
    const { data, error } = await sb
      .from("articles")
      .select("slug, cover_image, published_at")
      .eq("id", input.id)
      .maybeSingle();
    if (error) return { ok: false, reason: error.message };
    if (!data) return { ok: false, reason: "article_not_found" };
    existing = data;
  }

  // 公開日時: 入力があればそれ、無ければ既存値、初めて公開するなら現在時刻
  let publishedAt: string | null = input.publishedAt?.trim()
    ? new Date(input.publishedAt).toISOString()
    : existing?.published_at ?? null;
  if (input.status === "published" && !publishedAt) publishedAt = new Date().toISOString();

  const row = {
    slug,
    title,
    summary,
    body,
    category: input.category,
    cover_image: input.coverImage.trim(),
    related_stylist_ids: Array.from(new Set(input.relatedStylistIds)),
    status: input.status,
    target_keyword: input.targetKeyword?.trim() || null,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  };

  const id = input.id ?? newArticleId();
  const { error } = input.id
    ? await sb.from("articles").update(row).eq("id", id)
    : await sb.from("articles").insert({ id, ...row });
  if (error) return { ok: false, reason: error.message };

  // カバー画像を差し替えたら、古い画像（自前ストレージの分）を消す
  if (existing?.cover_image && existing.cover_image !== row.cover_image) {
    await deleteStorageObjectByUrl(existing.cover_image);
  }

  revalidateArticlePages(existing && existing.slug !== slug ? [slug, existing.slug] : [slug]);
  return { ok: true, id, slug };
}

export async function deleteArticle(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sb = getSupabase();
  const { data: existing, error: getErr } = await sb
    .from("articles")
    .select("slug, cover_image")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return { ok: false, reason: getErr.message };
  if (!existing) return { ok: false, reason: "article_not_found" };

  const { error } = await sb.from("articles").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };

  await deleteStorageObjectByUrl(existing.cover_image);
  revalidateArticlePages([existing.slug]);
  return { ok: true };
}
