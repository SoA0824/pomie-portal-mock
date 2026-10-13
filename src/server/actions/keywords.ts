"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";

type Result = { ok: true } | { ok: false; reason: string };

function now() {
  return new Date().toISOString();
}

/**
 * 候補を承認または却下する。
 * 承認した候補は、次回の自動実行（GitHub Actions / scripts/articles/run.mjs write）で記事化される。
 */
export async function decideKeywordCandidates(
  ids: string[],
  decision: "approved" | "rejected",
  note?: string
): Promise<Result> {
  const targets = Array.from(new Set(ids.filter(Boolean)));
  if (targets.length === 0) return { ok: false, reason: "候補が選ばれていません" };

  const patch: Record<string, unknown> = {
    status: decision,
    decided_at: now(),
    updated_at: now(),
    error: null,
  };
  if (note !== undefined) patch.note = note.trim() || null;

  const { error } = await getSupabase()
    .from("keyword_candidates")
    .update(patch)
    .in("id", targets)
    // 記事化済みの候補は触らない
    .neq("status", "written");
  if (error) return { ok: false, reason: error.message };

  revalidatePath("/admin/keywords");
  return { ok: true };
}

/** 却下・失敗した候補を「承認（記事化待ち）」に戻す */
export async function retryKeywordCandidate(id: string): Promise<Result> {
  return decideKeywordCandidates([id], "approved");
}

export async function updateKeywordNote(id: string, note: string): Promise<Result> {
  const { error } = await getSupabase()
    .from("keyword_candidates")
    .update({ note: note.trim() || null, updated_at: now() })
    .eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/admin/keywords");
  return { ok: true };
}

export async function deleteKeywordCandidate(id: string): Promise<Result> {
  const { error } = await getSupabase()
    .from("keyword_candidates")
    .delete()
    .eq("id", id)
    .neq("status", "written");
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/admin/keywords");
  return { ok: true };
}

// ===== 種キーワード =====

export async function addKeywordSeed(keyword: string, note?: string): Promise<Result> {
  const kw = keyword.trim().replace(/\s+/g, " ");
  if (!kw) return { ok: false, reason: "キーワードを入力してください" };
  const id = `seed-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await getSupabase()
    .from("keyword_seeds")
    .insert({ id, keyword: kw, enabled: true, note: note?.trim() || null });
  if (error) {
    return {
      ok: false,
      reason: /duplicate|unique/i.test(error.message) ? "同じ種キーワードが既にあります" : error.message,
    };
  }
  revalidatePath("/admin/keywords");
  return { ok: true };
}

export async function setKeywordSeedEnabled(id: string, enabled: boolean): Promise<Result> {
  const { error } = await getSupabase().from("keyword_seeds").update({ enabled }).eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/admin/keywords");
  return { ok: true };
}

export async function deleteKeywordSeed(id: string): Promise<Result> {
  const { error } = await getSupabase().from("keyword_seeds").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/admin/keywords");
  return { ok: true };
}
