"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Store, Stylist } from "@/lib/types";
import { StylistAvatar } from "@/components/common/StylistAvatar";
import { SyncInstagramButton } from "@/components/admin/SyncInstagramButton";
import { formatDateTime } from "@/lib/format";
import { bulkUpdateStylists } from "@/server/actions/bulkUpdateStylists";

export type SortKey = "id" | "name" | "rating" | "featured" | "newest";

const SORT_LABELS: Record<SortKey, string> = {
  id: "ID 昇順",
  name: "名前 (50音)",
  rating: "評価が高い順",
  featured: "注目美容師優先",
  newest: "新着順",
};

function compare(a: Stylist, b: Stylist, key: SortKey): number {
  switch (key) {
    case "name":
      return (a.nameKana || a.name).localeCompare(b.nameKana || b.name, "ja");
    case "rating":
      return b.rating - a.rating;
    case "featured":
      if (a.featuredFlag !== b.featuredFlag) return a.featuredFlag ? -1 : 1;
      return b.rating - a.rating;
    case "newest":
      // 新規登録の id は "st-{nanoid}" 形式、シードは "st-01" 等。後者の方が新着が分かりにくいので
      // updatedAt が無い MVP では id 降順で代用
      return b.id.localeCompare(a.id);
    case "id":
    default:
      return a.id.localeCompare(b.id);
  }
}

export function AdminStylistList({
  stylists,
  storesById,
  sort,
}: {
  stylists: Stylist[];
  storesById: Record<string, Store>;
  sort: SortKey;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...stylists].sort((a, b) => compare(a, b, sort)),
    [stylists, sort]
  );

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    if (checked) setSelected(new Set(sorted.map((s) => s.id)));
    else setSelected(new Set());
  };

  const runBulk = (changes: {
    contractStatus?: "active" | "inactive";
    featuredFlag?: boolean;
  }) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await bulkUpdateStylists({ ids, changes });
      if (result.ok) {
        setFeedback(`${result.updatedCount} 件を更新しました`);
        setSelected(new Set());
        router.refresh();
      } else {
        setFeedback(`失敗: ${result.reason}`);
      }
    });
  };

  const onSortChange = (value: string) => {
    const url = new URL(window.location.href);
    if (value === "id") url.searchParams.delete("sort");
    else url.searchParams.set("sort", value);
    router.push(url.pathname + url.search);
  };

  const allChecked = sorted.length > 0 && selected.size === sorted.length;
  const someChecked = selected.size > 0 && selected.size < sorted.length;

  return (
    <>
      {/* コントロールバー: 全選択 + ソート */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-pomie-200">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked;
            }}
            onChange={(e) => toggleAllVisible(e.target.checked)}
          />
          全選択
        </label>
        <span className="text-xs text-ink-500">{selected.size} / {sorted.length} 件選択中</span>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label className="text-xs font-semibold text-ink-700">並び順</label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="rounded-lg border border-ink-100 bg-white px-2 py-1 text-xs"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 一括アクションバー: 1件以上選択時に表示 */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-pomie-500 p-3 text-white shadow-md">
          <span className="text-sm font-semibold">{selected.size} 件選択中</span>
          <BulkButton
            label="掲載中にする"
            onClick={() => runBulk({ contractStatus: "active" })}
            disabled={pending}
          />
          <BulkButton
            label="停止中にする"
            onClick={() => runBulk({ contractStatus: "inactive" })}
            disabled={pending}
          />
          <BulkButton
            label="注目にする"
            onClick={() => runBulk({ featuredFlag: true })}
            disabled={pending}
          />
          <BulkButton
            label="注目を解除"
            onClick={() => runBulk({ featuredFlag: false })}
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="ml-auto rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-60"
          >
            選択解除
          </button>
        </div>
      )}

      {feedback && (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {feedback}
        </div>
      )}

      <section className="mt-3 space-y-3">
        {sorted.map((s) => {
          const store = storesById[s.storeId];
          const checked = selected.has(s.id);
          return (
            <article
              key={s.id}
              className={`card p-4 md:p-5 transition ${
                checked ? "ring-2 ring-pomie-500" : ""
              }`}
            >
              <div className="flex flex-wrap items-start gap-4">
                <label className="flex flex-shrink-0 cursor-pointer items-center pt-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleOne(s.id, e.target.checked)}
                    className="h-5 w-5"
                  />
                </label>
                <StylistAvatar
                  src={s.avatar}
                  name={s.name}
                  rounded
                  className="h-16 w-16 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-lg font-bold">{s.name}</h2>
                    {s.nameKana && (
                      <span className="text-xs text-ink-500">{s.nameKana}</span>
                    )}
                    <ContractBadge status={s.contractStatus} />
                    {s.featuredFlag && <FeaturedBadge />}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-ink-500">{s.id}</p>
                  <div className="mt-2 grid gap-2 text-xs md:grid-cols-4">
                    <Field label="店舗">{store?.name ?? "-"}</Field>
                    <Field label="エリア">{s.area || "—"}</Field>
                    <Field label="評価 / 施術数">
                      ★ {s.rating.toFixed(1)} / {s.worksCount} 件
                    </Field>
                    <Field label="得意メニュー">
                      {s.menus.slice(0, 2).join(" / ") || "-"}
                    </Field>
                  </div>
                  {s.instagramHandle && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-semibold text-ink-500">Instagram</span>
                      <a
                        href={`https://www.instagram.com/${s.instagramHandle}/`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-pomie-600 hover:underline"
                      >
                        @{s.instagramHandle}
                      </a>
                      {s.instagramSyncedAt ? (
                        <span className="text-ink-500">
                          最終同期: {formatDateTime(s.instagramSyncedAt)}
                        </span>
                      ) : (
                        <span className="text-ink-500">未同期</span>
                      )}
                      <SyncInstagramButton stylistId={s.id} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100/70 pt-3 text-xs">
                <Link
                  href={`/admin/stylists/${s.id}/edit`}
                  className="rounded-full bg-pomie-500 px-3 py-1 font-semibold text-white transition hover:bg-pomie-600"
                >
                  編集
                </Link>
                <Link
                  href={`/stylists/${s.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-ink-100 bg-white px-3 py-1 font-semibold text-ink-700 transition hover:bg-pomie-100"
                >
                  詳細を見る ↗
                </Link>
                {s.contractStatus === "inactive" && (
                  <span className="text-ink-500">
                    （停止中のため公開ページは表示されません）
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}

function BulkButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-pomie-700 transition hover:bg-pomie-100 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <div className="mt-0.5 text-ink-900">{children}</div>
    </div>
  );
}

function ContractBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        status === "active"
          ? "bg-green-100 text-green-800"
          : "bg-ink-100 text-ink-500"
      }`}
    >
      {status === "active" ? "掲載中" : "停止中"}
    </span>
  );
}

function FeaturedBadge() {
  return (
    <span className="rounded-full bg-pomie-100 px-2 py-0.5 text-[10px] font-semibold text-pomie-700">
      ★ 注目
    </span>
  );
}
