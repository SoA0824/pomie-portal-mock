"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveAndPublishArticle } from "@/server/actions/articles";
import type { StylistOption } from "@/components/admin/ArticleForm";

const REASON_LABELS: Record<string, string> = {
  missing_summary_for_publish: "概要（リード文）が空です。編集画面で入力してください",
  missing_body_for_publish: "本文が空です。編集画面で入力してください",
  article_not_found: "記事が見つかりません",
};

/**
 * 記事一覧の「承認して公開」。
 * 監修者（任意）を選んで公開する。内容の確認はプレビューで行う前提。
 */
export function ApproveArticlePanel({
  articleId,
  articleTitle,
  stylists,
  initialSupervisorStylistId,
}: {
  articleId: string;
  articleTitle: string;
  stylists: StylistOption[];
  initialSupervisorStylistId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supervisorStylistId, setSupervisorStylistId] = useState(initialSupervisorStylistId ?? "");
  const [other, setOther] = useState(false);
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorTitle, setSupervisorTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const publish = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveAndPublishArticle({
        id: articleId,
        supervisorStylistId: other ? null : supervisorStylistId || null,
        supervisorName: other ? supervisorName : undefined,
        supervisorTitle: other ? supervisorTitle : undefined,
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(REASON_LABELS[result.reason] ?? `公開に失敗しました（${result.reason}）`);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-pomie-500 px-3 py-1 text-xs font-semibold text-white hover:bg-pomie-600"
      >
        承認して公開
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-lg bg-pomie-50 p-3 text-xs ring-1 ring-pomie-200">
      <p className="font-semibold text-ink-900">「{articleTitle}」を公開します</p>
      <p className="mt-1 text-ink-500">
        プレビューで内容・事実関係・[要確認] の箇所を確認してから公開してください。
      </p>

      <div className="mt-3 space-y-2">
        <p className="font-semibold text-ink-700">監修者（任意）</p>
        <label className="flex items-center gap-2">
          <input type="radio" name={`sv-${articleId}`} checked={!other} onChange={() => setOther(false)} />
          <span>美容師から選ぶ</span>
          <select
            value={supervisorStylistId}
            onChange={(e) => setSupervisorStylistId(e.target.value)}
            disabled={other}
            className="input max-w-xs text-xs"
          >
            <option value="">（監修者なし）</option>
            {stylists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.storeName}）{s.active ? "" : "・非公開"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <input type="radio" name={`sv-${articleId}`} checked={other} onChange={() => setOther(true)} />
          <span>その他の人</span>
          <input
            value={supervisorName}
            onChange={(e) => setSupervisorName(e.target.value)}
            disabled={!other}
            placeholder="名前"
            className="input max-w-[160px] text-xs"
          />
          <input
            value={supervisorTitle}
            onChange={(e) => setSupervisorTitle(e.target.value)}
            disabled={!other}
            placeholder="肩書（例: 毛髪診断士）"
            className="input max-w-[200px] text-xs"
          />
        </label>
        <p className="text-[11px] text-ink-500">
          監修者を付けると、記事に「この記事の監修者」として名前・肩書（美容師なら店舗とプロフィールへのリンク）が表示されます。
          本人の了承を得てから設定してください。
        </p>
      </div>

      {error && <p className="mt-2 rounded bg-red-50 p-2 text-red-700">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={pending || (other && !supervisorName.trim())}
          className="rounded-full bg-pomie-500 px-4 py-1.5 font-semibold text-white hover:bg-pomie-600 disabled:opacity-50"
        >
          {pending ? "公開中..." : "公開する"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-full border border-ink-100 bg-white px-4 py-1.5 font-semibold text-ink-700"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
