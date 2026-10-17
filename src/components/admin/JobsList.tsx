"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelJob, retryJob, triggerRunnerNow } from "@/server/actions/jobs";
import { JOB_KIND_LABEL, JOB_STATUS_LABEL } from "@/lib/jobs/labels";
import { formatDateTime } from "@/lib/format";
import type { Job } from "@/lib/types";

function targetLink(job: Job): { href: string; label: string } | null {
  if (!job.targetId) return null;
  if (job.kind === "social" || job.kind === "social_images") return { href: `/admin/social/${job.targetId}`, label: "投稿を開く" };
  if (job.kind === "write") return { href: "/admin/keywords?tab=approved", label: "候補を見る" };
  if (job.kind === "rewrite") return { href: "/admin/articles", label: "記事一覧" };
  return null;
}

function describeResult(job: Job): string {
  const r = job.result ?? {};
  const parts: string[] = [];
  if (typeof r.written === "object" && Array.isArray(r.written)) parts.push(`記事 ${r.written.length} 本`);
  if (typeof r.proposed === "number") parts.push(`候補 ${r.proposed} 件`);
  if (typeof r.credits === "number") parts.push(`ラッコ ${r.credits} クレジット`);
  if (typeof r.images === "number") parts.push(`画像 ${r.images} 枚`);
  const usage = r.usage as { input?: number; output?: number } | undefined;
  if (usage && (usage.input || usage.output)) parts.push(`トークン 入力 ${usage.input ?? 0} / 出力 ${usage.output ?? 0}`);
  if (typeof r.seconds === "number") parts.push(`${r.seconds} 秒`);
  if (typeof r.imageError === "string" && r.imageError) parts.push(`画像の失敗: ${r.imageError}`);
  return parts.join(" ・ ");
}

export function JobsList({ jobs, dispatchConfigured }: { jobs: Job[]; dispatchConfigured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const active = jobs.some((j) => j.status === "queued" || j.status === "running");

  // 実行中・実行待ちがあるあいだは 20 秒ごとに更新
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(t);
  }, [active, router]);

  const run = (fn: () => Promise<{ ok: boolean; reason?: string; message?: string }>, done: string) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      setMessage(r.ok ? r.message ?? done : `失敗しました: ${r.reason}`);
      router.refresh();
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => run(() => triggerRunnerNow(), "起動しました")} disabled={pending || !dispatchConfigured} className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50">
          待ちジョブを今すぐ実行
        </button>
        {!dispatchConfigured && (
          <span className="text-ink-500">
            Vercel に <code className="rounded bg-ink-100 px-1">GITHUB_DISPATCH_TOKEN</code> を設定すると、ボタンですぐ起動できます（未設定でも 1 時間ごとに自動で実行されます）
          </span>
        )}
        {active && <span className="text-ink-500">20 秒ごとに自動更新しています</span>}
      </div>
      {message && <p className="rounded-lg bg-pomie-50 px-3 py-2 text-xs text-pomie-700">{message}</p>}

      {jobs.length === 0 ? (
        <p className="text-sm text-ink-500">まだジョブはありません。キーワード候補・記事のリライト・SNS 投稿の各画面にある「API で…」のボタンから積めます。</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-pomie-50 text-xs text-ink-500">
              <tr>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">内容</th>
                <th className="px-3 py-2">依頼</th>
                <th className="px-3 py-2">結果</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const s = JOB_STATUS_LABEL[j.status];
                const link = targetLink(j);
                return (
                  <tr key={j.id} className="border-t border-ink-100/70 align-top text-xs">
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${s.className}`}>{s.label}</span>
                      {j.attempts > 1 && <p className="mt-1 text-[11px] text-ink-500">{j.attempts} 回目</p>}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-900">{JOB_KIND_LABEL[j.kind]}</p>
                      <p className="text-[11px] text-ink-500">
                        {j.targetId && <span className="font-mono">{j.targetId} </span>}
                        {Object.keys(j.params).length > 0 && <span>{JSON.stringify(j.params)}</span>}
                        {link && (
                          <>
                            {" "}
                            <Link href={link.href} className="text-pomie-600 hover:underline">
                              {link.label}
                            </Link>
                          </>
                        )}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500">
                      {formatDateTime(j.createdAt)}
                      <br />
                      {j.requestedBy === "admin" ? "管理画面" : j.requestedBy === "schedule" ? "スケジュール" : j.requestedBy}
                      {j.finishedAt && (
                        <>
                          <br />
                          終了 {formatDateTime(j.finishedAt)}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {j.error && <p className="text-red-700">{j.error}</p>}
                      {j.status === "done" && <p className="text-ink-700">{describeResult(j) || "完了"}</p>}
                      {j.log && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-pomie-600">ログ</summary>
                          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-ink-100/60 p-2 text-[11px] text-ink-700">{j.log}</pre>
                        </details>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {j.status === "queued" && (
                        <button type="button" disabled={pending} onClick={() => run(() => cancelJob(j.id), "取り消しました")} className="text-ink-500 hover:underline">
                          取り消す
                        </button>
                      )}
                      {(j.status === "failed" || j.status === "canceled") && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(async () => retryJob(j.id), "やり直しを予約しました")}
                          className="text-pomie-600 hover:underline"
                        >
                          やり直す
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
