"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncInstagramPosts } from "@/server/actions/syncInstagramPosts";

const REASON_LABELS: Record<string, string> = {
  stylist_not_found: "美容師が見つかりません",
  no_instagram_handle: "Instagram ハンドルが未登録です",
};

/**
 * Instagram 投稿の取得ボタン。
 *
 * autoStart=true（＝まだ一度も取得していない美容師）の場合は、
 * 画面表示後に自動で取得を開始する。
 * 取得は 5〜30 秒かかるため、保存処理とは切り離してここで実行している。
 */
export function SyncInstagramButton({
  stylistId,
  autoStart = false,
}: {
  stylistId: string;
  /** 未取得の美容師について、画面表示時に自動で取得を開始する */
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const startedRef = useRef(false);

  const run = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await syncInstagramPosts(stylistId);
      if (result.ok) {
        setFeedback(`${result.count} 件取得しました`);
        router.refresh();
      } else {
        setFeedback(REASON_LABELS[result.reason] ?? `失敗: ${result.reason}`);
      }
    });
  };

  // 未取得なら自動で 1 回だけ開始する
  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-pomie-700">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-pomie-200 border-t-pomie-600" />
        Instagram 取得中...
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        className="rounded-full border border-pomie-500 px-3 py-1 text-[11px] font-semibold text-pomie-600 transition hover:bg-pomie-100"
      >
        Instagram 更新
      </button>
      {feedback && <span className="text-[11px] text-ink-500">{feedback}</span>}
    </span>
  );
}
