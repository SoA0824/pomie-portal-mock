"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { triggerRunner } from "@/lib/integrations/github";
import { JOB_KINDS, type JobKind } from "@/lib/types";

type EnqueueResult = { ok: true; id: string; existing: boolean; triggered: boolean; note?: string } | { ok: false; reason: string };
type Result = { ok: true; message?: string } | { ok: false; reason: string };

function now() {
  return new Date().toISOString();
}

function newJobId() {
  return `job-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function revalidateAll() {
  for (const p of ["/admin/jobs", "/admin/keywords", "/admin/articles", "/admin/social"]) revalidatePath(p);
}

/**
 * ジョブを積む（管理画面の「いま実行」）。同じ対象の未完了ジョブがあればそれを返す。
 * GitHub のトークンがあればすぐ起動し、無ければ 15 分ごとの定期実行に任せる。
 */
export async function enqueueJob(input: { kind: JobKind; targetId?: string | null; params?: Record<string, unknown> }): Promise<EnqueueResult> {
  if (!JOB_KINDS.includes(input.kind)) return { ok: false, reason: "ジョブの種類が不正です" };
  const sb = getSupabase();
  if (input.targetId) {
    const { data: open, error } = await sb.from("jobs").select("id, status").eq("kind", input.kind).eq("target_id", input.targetId).in("status", ["queued", "running"]).limit(1);
    if (error) return { ok: false, reason: error.message.includes("jobs") ? "ジョブ用のテーブルがありません。supabase/migration-015-jobs.sql を実行してください" : error.message };
    if (open && open[0]) return { ok: true, id: open[0].id, existing: true, triggered: false };
  }
  const id = newJobId();
  const { error } = await sb.from("jobs").insert({ id, kind: input.kind, target_id: input.targetId ?? null, params: input.params ?? {}, requested_by: "admin", status: "queued" });
  if (error) return { ok: false, reason: error.message.includes("jobs") ? "ジョブ用のテーブルがありません。supabase/migration-015-jobs.sql を実行してください" : error.message };
  const t = await triggerRunner();
  revalidateAll();
  return { ok: true, id, existing: false, triggered: t.triggered, note: t.error };
}

/** 待ちジョブを今すぐ実行する（GitHub Actions を起動） */
export async function triggerRunnerNow(): Promise<Result> {
  const t = await triggerRunner();
  return t.triggered ? { ok: true, message: "GitHub Actions を起動しました（1〜2 分で動き始めます）" } : { ok: false, reason: t.error ?? "起動できませんでした" };
}

export async function cancelJob(id: string): Promise<Result> {
  const { data, error } = await getSupabase().from("jobs").update({ status: "canceled", finished_at: now(), updated_at: now() }).eq("id", id).eq("status", "queued").select("id");
  if (error) return { ok: false, reason: error.message };
  if (!data || data.length === 0) return { ok: false, reason: "実行待ちのジョブだけ取り消せます（すでに動いています）" };
  revalidateAll();
  return { ok: true };
}

/** 失敗・取り消しのジョブを同じ内容でやり直す */
export async function retryJob(id: string): Promise<EnqueueResult> {
  const sb = getSupabase();
  const { data: job, error } = await sb.from("jobs").select("kind, target_id, params, status").eq("id", id).maybeSingle();
  if (error) return { ok: false, reason: error.message };
  if (!job) return { ok: false, reason: "ジョブが見つかりません" };
  if (!["failed", "canceled", "done"].includes(job.status)) return { ok: false, reason: "終わったジョブだけやり直せます" };
  return enqueueJob({ kind: job.kind as JobKind, targetId: job.target_id, params: job.params ?? {} });
}
