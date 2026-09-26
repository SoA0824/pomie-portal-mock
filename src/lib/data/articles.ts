import type { Article, ArticleCategory } from "../types";
import { getSupabase, type ArticleRow } from "@/lib/supabase/client";

function rowToArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category as ArticleCategory,
    publishedAt: row.published_at ?? row.created_at,
    coverImage: row.cover_image ?? "",
    relatedStylistIds: row.related_stylist_ids ?? [],
    status: row.status,
    targetKeyword: row.target_keyword,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 公開中の記事（新しい順）。
 * サイト側の表示・sitemap はすべてこれを使う。
 * 取得に失敗してもサイト全体を落とさないよう、空配列を返す。
 */
export async function getAllArticles(): Promise<Article[]> {
  try {
    const { data, error } = await getSupabase()
      .from("articles")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToArticle);
  } catch (err) {
    console.error("[articles] 公開記事の取得に失敗:", err);
    return [];
  }
}

/** 公開中の記事を slug で取得（下書きは返さない → 404） */
export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  try {
    const { data, error } = await getSupabase()
      .from("articles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToArticle(data) : undefined;
  } catch (err) {
    console.error("[articles] 記事の取得に失敗:", err);
    return undefined;
  }
}

export async function getArticleCategories(): Promise<ArticleCategory[]> {
  const set = new Set<ArticleCategory>();
  for (const a of await getAllArticles()) set.add(a.category);
  return Array.from(set);
}

export async function getFeaturedArticles(limit = 3): Promise<Article[]> {
  return (await getAllArticles()).slice(0, limit);
}

// ===== 管理画面用（下書きを含む。エラーはそのまま投げて画面で知らせる） =====

export async function getAllArticlesIncludingDrafts(): Promise<Article[]> {
  const { data, error } = await getSupabase()
    .from("articles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`記事の取得に失敗しました: ${error.message}`);
  return (data ?? []).map(rowToArticle);
}

export async function getArticleByIdIncludingDrafts(id: string): Promise<Article | undefined> {
  const { data, error } = await getSupabase()
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`記事の取得に失敗しました: ${error.message}`);
  return data ? rowToArticle(data) : undefined;
}
