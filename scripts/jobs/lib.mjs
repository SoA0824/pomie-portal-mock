/**
 * ジョブ（管理画面やスケジュールから積まれた仕事）の共通処理。
 * テーブル jobs は supabase/migration-015-jobs.sql。
 */
import os from "node:os";
import { newId, rest } from "../articles/lib.mjs";

export const KINDS = ["propose", "write", "rewrite", "social", "social_images"];
export const KIND_LABEL = {
  propose: "キーワード候補の提案",
  write: "記事の執筆",
  rewrite: "リライト案の作成",
  social: "SNS 投稿の作成",
  social_images: "SNS 画像の作り直し",
};

const now = () => new Date().toISOString();

export function runnerName() {
  return process.env.GITHUB_RUN_ID ? `github-actions#${process.env.GITHUB_RUN_ID}` : `${os.hostname()}#${process.pid}`;
}

/** ジョブを積む。同じ対象の未完了ジョブがあればそれを返す（二重実行を防ぐ） */
export async function enqueue(db, { kind, targetId = null, params = {}, requestedBy = "cli" }) {
  if (!KINDS.includes(kind)) throw new Error(`ジョブの種類が不正です: ${kind}（${KINDS.join(" / ")}）`);
  if (targetId) {
    const open = await rest(db, "GET", `jobs?select=id,status&kind=eq.${kind}&target_id=eq.${encodeURIComponent(targetId)}&status=in.(queued,running)&limit=1`);
    if (open[0]) return { ...open[0], existing: true };
  }
  const id = newId("job");
  await rest(db, "POST", "jobs", {
    body: { id, kind, target_id: targetId, params, requested_by: requestedBy, status: "queued" },
    prefer: "return=minimal",
  });
  return { id, status: "queued", existing: false };
}

/** いちばん古い待ちジョブを取って「実行中」にする（同時に動く実行者がいても 1 つだけが取れる） */
export async function claimNext(db, runner) {
  for (let i = 0; i < 5; i++) {
    const [job] = await rest(db, "GET", "jobs?select=*&status=eq.queued&order=created_at&limit=1");
    if (!job) return null;
    const claimed = await rest(db, "PATCH", `jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.queued`, {
      body: { status: "running", started_at: now(), attempts: (job.attempts ?? 0) + 1, runner, updated_at: now() },
      prefer: "return=representation",
    });
    if (Array.isArray(claimed) && claimed.length) return { ...job, ...claimed[0] };
  }
  return null;
}

export async function finish(db, id, { status, result = null, error = null, log = null }) {
  await rest(db, "PATCH", `jobs?id=eq.${encodeURIComponent(id)}`, {
    body: { status, result, error, log, finished_at: now(), updated_at: now() },
    prefer: "return=minimal",
  });
}

/** 実行者が落ちて「実行中」のまま残ったジョブを戻す（3 回目以降は失敗にする） */
export async function recoverStale(db, { minutes = 60 } = {}) {
  const before = new Date(Date.now() - minutes * 60000).toISOString();
  const stale = await rest(db, "GET", `jobs?select=id,attempts&status=eq.running&started_at=lt.${encodeURIComponent(before)}`);
  for (const j of stale) {
    const giveUp = (j.attempts ?? 0) >= 3;
    await rest(db, "PATCH", `jobs?id=eq.${encodeURIComponent(j.id)}`, {
      body: giveUp
        ? { status: "failed", error: "実行が途中で止まりました（3 回試しても終わりませんでした）", finished_at: now(), updated_at: now() }
        : { status: "queued", error: "実行が途中で止まったため、やり直します", updated_at: now() },
      prefer: "return=minimal",
    });
  }
  return stale.length;
}

/** 実行ログを画面にも DB にも残す */
export function makeLogger() {
  const lines = [];
  const log = (message) => {
    console.log(message);
    lines.push(`${new Date().toISOString().slice(11, 19)} ${message}`);
  };
  return { log, text: () => lines.join("\n").slice(-8000) };
}
