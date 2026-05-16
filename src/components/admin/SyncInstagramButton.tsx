"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncInstagramPosts } from "@/server/actions/syncInstagramPosts";

const REASON_LABELS: Record<string, string> = {
  stylist_not_found: "美容師が見つかりません",
  no_instagram_handle: "Instagram ハンドルが未登録です",
};

export function SyncInstagramButton({ stylistId }: { stylistId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const onClick = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await syncInstagramPosts(stylistId);
      if (result.ok) {
        setFeedback(`${result.count} 件取得 (${result.via})`);
        router.refresh();
      } else {
        setFeedback(REASON_LABELS[result.reason] ?? `失敗: ${result.reason}`);
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full border border-pomie-500 px-3 py-1 text-[11px] font-semibold text-pomie-600 transition hover:bg-pomie-100 disabled:opacity-60"
      >
        {pending ? "同期中..." : "Instagram 更新"}
      </button>
      {feedback && <span className="text-[11px] text-ink-500">{feedback}</span>}
    </span>
  );
}
