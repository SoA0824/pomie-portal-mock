import type { Job } from "../types";
import { getSupabase, type JobRow } from "@/lib/supabase/client";

export function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    targetId: row.target_id,
    params: row.params ?? {},
    requestedBy: row.requested_by ?? "admin",
    attempts: row.attempts ?? 0,
    runner: row.runner,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    result: row.result,
    error: row.error,
    log: row.log,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 最近のジョブ（新しい順）。テーブルが無いときは error に理由 */
export async function listJobs(limit = 50): Promise<{ jobs: Job[]; error: string | null }> {
  const { data, error } = await getSupabase().from("jobs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) return { jobs: [], error: error.message };
  return { jobs: (data ?? []).map((r) => rowToJob(r as JobRow)), error: null };
}

/** 対象ごとの未完了ジョブ（画面のバッジ用）。キーは target_id */
export async function getOpenJobsByTarget(): Promise<Map<string, Job>> {
  const map = new Map<string, Job>();
  const { data, error } = await getSupabase().from("jobs").select("*").in("status", ["queued", "running"]).order("created_at", { ascending: true });
  if (error) return map;
  for (const r of data ?? []) {
    const j = rowToJob(r as JobRow);
    if (j.targetId) map.set(j.targetId, j);
  }
  return map;
}
