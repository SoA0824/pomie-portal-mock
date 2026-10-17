import type { Article, ArticleCategory, ArticleGenerationLog, ArticleSupervisor } from "../types";
import { getSupabase, type ArticleRow } from "@/lib/supabase/client";
import { getStylistByIdIncludingInactive } from "./stylists";
import { getStoreById } from "./stores";

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
    areas: row.areas ?? [],
    source: row.source,
    supervisorStylistId: row.supervisor_stylist_id ?? null,
    supervisorName: row.supervisor_name ?? null,
    supervisorTitle: row.supervisor_title ?? null,
    keywordCandidateId: row.keyword_candidate_id ?? null,
    generationLog: (row.generation_log as ArticleGenerationLog | null) ?? null,
    pinnedAt: row.pinned_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 記事の監修者を表示用に解決する。
 * 美容師を選んでいればその名前・店舗・写真を使い、公開中ならプロフィールへのリンクも付ける。
 */
export async function resolveArticleSupervisor(article: Article): Promise<ArticleSupervisor | null> {
  if (article.supervisorStylistId) {
    const stylist = await getStylistByIdIncludingInactive(article.supervisorStylistId);
    if (stylist) {
      const store = getStoreById(stylist.storeId);
      return {
        name: stylist.name,
        title: `${store ? store.name : "ポミエ"} 美容師`,
        stylistId: stylist.id,
        avatar: stylist.avatar || undefined,
        url: stylist.contractStatus === "active" ? `/stylists/${stylist.id}` : undefined,
      };
    }
  }
  if (article.supervisorName) {
    return { name: article.supervisorName, title: article.supervisorTitle ?? "" };
  }
  return null;
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

/** エリアが付いた公開記事（エリア一覧ページ用） */
export async function getArticlesByArea(areaSlug: string): Promise<Article[]> {
  try {
    const { data, error } = await getSupabase()
      .from("articles")
      .select("*")
      .eq("status", "published")
      .contains("areas", [areaSlug])
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToArticle);
  } catch (err) {
    console.error("[articles] エリアの記事の取得に失敗:", err);
    return [];
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

/** トップの一番上に出す記事: 固定した記事（固定が新しい順）→ 新着順 */
export async function getTopArticles(limit = 4): Promise<Article[]> {
  const all = await getAllArticles();
  const pinned = all.filter((a) => a.pinnedAt).sort((a, b) => ((b.pinnedAt ?? "") > (a.pinnedAt ?? "") ? 1 : -1));
  const rest = all.filter((a) => !a.pinnedAt);
  return [...pinned, ...rest].slice(0, limit);
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
