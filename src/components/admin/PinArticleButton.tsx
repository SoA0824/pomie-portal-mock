"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setArticlePinned } from "@/server/actions/articles";

/** 記事一覧の「トップに固定」。固定した記事はトップの一番上に、新着より前に並ぶ */
export function PinArticleButton({ articleId, pinned }: { articleId: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await setArticlePinned(articleId, !pinned);
            if (r.ok) router.refresh();
            else setError(r.reason);
          })
        }
        className="text-pomie-600 hover:underline disabled:text-ink-300"
      >
        {pinned ? "トップ固定を外す" : "トップに固定"}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </span>
  );
}
