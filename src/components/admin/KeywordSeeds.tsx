"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addKeywordSeed, deleteKeywordSeed, setKeywordSeedEnabled } from "@/server/actions/keywords";
import type { KeywordSeed } from "@/lib/types";
import { formatDate } from "@/lib/format";

/**
 * 種キーワードの管理。
 * 候補の提案は、ここにある有効な種（無ければ美容師の情報から自動生成）をもとに行う。
 */
export function KeywordSeeds({ seeds }: { seeds: KeywordSeed[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setKeyword("");
        router.refresh();
      } else {
        setError(result.reason ?? "失敗しました");
      }
    });
  };

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-ink-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">種キーワード</h2>
          <p className="mt-1 text-xs text-ink-500">
            候補を探す起点になる言葉です（例: 表参道 髪質改善、恵比寿 白髪ぼかし）。
            {seeds.length === 0 && " まだ登録が無いので、掲載中の美容師の得意メニュー × エリアから自動で作られます。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-semibold text-pomie-600 hover:underline"
        >
          {open ? "閉じる" : `編集する（${seeds.length} 件）`}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addKeywordSeed(keyword));
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: 表参道 髪質改善"
              className="input max-w-sm text-sm"
            />
            <button
              type="submit"
              disabled={pending || !keyword.trim()}
              className="rounded-full bg-pomie-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              追加
            </button>
            {error && <span className="text-xs text-red-700">{error}</span>}
          </form>

          {seeds.length > 0 && (
            <ul className="divide-y divide-ink-100/70 text-sm">
              {seeds.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      disabled={pending}
                      onChange={(e) => run(() => setKeywordSeedEnabled(s.id, e.target.checked))}
                    />
                    <span className={s.enabled ? "" : "text-ink-500 line-through"}>{s.keyword}</span>
                  </label>
                  <span className="text-xs text-ink-500">
                    {s.lastUsedAt ? `最終使用 ${formatDate(s.lastUsedAt)}` : "未使用"}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteKeywordSeed(s.id))}
                    className="ml-auto text-xs text-ink-500 hover:text-red-600"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
