"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateSlots, regenerateAllSlots } from "@/server/actions/regenerateSlots";

export function RegenerateSlotsButton({
  stylistId,
  size = "small",
}: {
  stylistId?: string;
  size?: "small" | "large";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const onClick = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = stylistId
        ? await regenerateSlots(stylistId)
        : await regenerateAllSlots();
      if (result.ok) {
        setFeedback(
          stylistId
            ? `予約枠を再生成しました`
            : `${result.affected} 名のスケジュールを再生成`
        );
        router.refresh();
      } else {
        setFeedback(`失敗: ${result.reason}`);
      }
    });
  };

  const label = stylistId ? "📅 スケジュール再生成" : "📅 全員のスケジュール再生成";

  if (size === "large") {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="rounded-full border border-pomie-500 px-4 py-1.5 text-sm font-semibold text-pomie-600 transition hover:bg-pomie-100 disabled:opacity-60"
        >
          {pending ? "生成中..." : label}
        </button>
        {feedback && <span className="text-xs text-ink-500">{feedback}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full border border-ink-100 bg-white px-3 py-1 text-[11px] font-semibold text-ink-700 transition hover:bg-pomie-100 disabled:opacity-60"
      >
        {pending ? "生成中..." : label}
      </button>
      {feedback && <span className="text-[11px] text-ink-500">{feedback}</span>}
    </span>
  );
}
