"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enqueueJob } from "@/server/actions/jobs";
import type { JobKind } from "@/lib/types";

/**
 * 「いま実行」ボタン。ジョブを積んで GitHub Actions を起動する（API で実行）。
 * 実行そのものはここでは行わないので、押したあとは「自動実行」ページで進み具合を見る。
 */
export function RunJobButton({
  kind,
  targetId,
  params,
  label,
  className,
  confirmText,
}: {
  kind: JobKind;
  targetId?: string | null;
  params?: Record<string, unknown>;
  label: string;
  className?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const click = () => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    startTransition(async () => {
      const r = await enqueueJob({ kind, targetId: targetId ?? null, params });
      if (!r.ok) {
        setMessage(`失敗: ${r.reason}`);
        return;
      }
      if (r.existing) setMessage("すでに実行待ち／実行中です");
      else if (r.triggered) setMessage("実行を始めました（数分で結果が出ます）");
      else setMessage(`予約しました。${r.note ?? "1 時間以内に始まります"}`);
      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={click} disabled={pending} className={className ?? "btn-secondary px-4 py-1.5 text-xs disabled:opacity-50"}>
        {pending ? "予約中…" : label}
      </button>
      {message && (
        <span className="text-[11px] text-ink-700">
          {message}{" "}
          <Link href="/admin/jobs" className="text-pomie-600 hover:underline">
            実行状況
          </Link>
        </span>
      )}
    </span>
  );
}
