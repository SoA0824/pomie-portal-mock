import type { ArticleCategory, ArticleRevision } from "../types";
import { getSupabase, type ArticleRevisionRow } from "@/lib/supabase/client";

function rowToRevision(row: ArticleRevisionRow): ArticleRevision {
  return {
    id: row.id,
    articleId: row.article_id,
    status: row.status,
    instruction: row.instruction ?? "",
    stylistSwap: row.stylist_swap ?? {},
    analysis: row.analysis,
    changeSummary: row.change_summary,
    proposedTitle: row.proposed_title,
    proposedSummary: row.proposed_summary,
    proposedBody: row.proposed_body,
    proposedCategory: (row.proposed_category as ArticleCategory | null) ?? null,
    proposedRelatedStylistIds: row.proposed_related_stylist_ids,
    proposedAreas: row.proposed_areas,
    baseUpdatedAt: row.base_updated_at,
    lint: row.lint,
    error: row.error,
    requestedAt: row.requested_at,
    proposedAt: row.proposed_at,
    decidedAt: row.decided_at,
  };
}

/** 記事のリライト履歴（新しい順）。テーブルが無いときは空（画面で案内する） */
export async function listRevisionsForArticle(
  articleId: string
): Promise<{ revisions: ArticleRevision[]; error: string | null }> {
  const { data, error } = await getSupabase()
    .from("article_revisions")
    .select("*")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });
  if (error) return { revisions: [], error: error.message };
  return { revisions: (data ?? []).map(rowToRevision), error: null };
}

/** 記事一覧のバッジ用: 進行中（依頼済み・提案あり）のリライトを記事 ID ごとに */
export async function getOpenRevisionStatusByArticle(): Promise<Map<string, "requested" | "proposed">> {
  const map = new Map<string, "requested" | "proposed">();
  const { data, error } = await getSupabase()
    .from("article_revisions")
    .select("article_id, status")
    .in("status", ["requested", "proposed"]);
  if (error) return map;
  for (const r of data ?? []) {
    // 提案ありを優先して表示
    if (r.status === "proposed" || !map.has(r.article_id)) map.set(r.article_id, r.status);
  }
  return map;
}
