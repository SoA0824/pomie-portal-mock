import type {
  ArticleCategory,
  KeywordCandidate,
  KeywordIntent,
  KeywordSeed,
} from "../types";
import { getSupabase, type KeywordCandidateRow, type KeywordSeedRow } from "@/lib/supabase/client";

function rowToCandidate(row: KeywordCandidateRow): KeywordCandidate {
  return {
    id: row.id,
    keyword: row.keyword,
    seed: row.seed,
    searchVolume: row.search_volume ?? null,
    seoDifficulty: row.seo_difficulty ?? null,
    competition: row.competition ?? null,
    cpc: row.cpc === null || row.cpc === undefined ? null : Number(row.cpc),
    intent: (row.intent as KeywordIntent | null) ?? null,
    category: (row.category as ArticleCategory | null) ?? null,
    suggestedTitle: row.suggested_title,
    angle: row.angle,
    faqQuestions: row.faq_questions ?? [],
    relatedKeywords: row.related_keywords ?? [],
    targetStylistIds: row.target_stylist_ids ?? [],
    score: row.score === null ? null : Number(row.score),
    reason: row.reason,
    status: row.status,
    note: row.note,
    articleId: row.article_id,
    error: row.error,
    proposedAt: row.proposed_at,
    decidedAt: row.decided_at,
    writtenAt: row.written_at,
    updatedAt: row.updated_at,
  };
}

function rowToSeed(row: KeywordSeedRow): KeywordSeed {
  return {
    id: row.id,
    keyword: row.keyword,
    enabled: row.enabled,
    note: row.note,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

/** 管理画面用。候補を全件（新しい順）。エラーはそのまま投げて画面で知らせる */
export async function listKeywordCandidates(): Promise<KeywordCandidate[]> {
  const { data, error } = await getSupabase()
    .from("keyword_candidates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`キーワード候補の取得に失敗しました: ${error.message}`);
  return (data ?? []).map(rowToCandidate);
}

export async function listKeywordSeeds(): Promise<KeywordSeed[]> {
  const { data, error } = await getSupabase()
    .from("keyword_seeds")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`種キーワードの取得に失敗しました: ${error.message}`);
  return (data ?? []).map(rowToSeed);
}
