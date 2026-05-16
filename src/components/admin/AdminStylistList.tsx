"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Store, Stylist } from "@/lib/types";
import { StylistAvatar } from "@/components/common/StylistAvatar";
import { SyncInstagramButton } from "@/components/admin/SyncInstagramButton";
import { RegenerateSlotsButton } from "@/components/admin/RegenerateSlotsButton";
import { formatDateTime } from "@/lib/format";
import {
  applyStylistEdits,
  type StylistEdit,
} from "@/server/actions/bulkUpdateStylists";

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
      return b.id.localeCompare(a.id);
    case "id":
    default:
      return a.id.localeCompare(b.id);
  }
}

type EditField = "contractStatus" | "featuredFlag";
type EditMap = Record<string, Partial<Pick<Stylist, "contractStatus" | "featuredFlag">>>;

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
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<EditMap>({});
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const stylistsById = useMemo(
    () => Object.fromEntries(stylists.map((s) => [s.id, s])),
    [stylists]
  );

  const sorted = useMemo(
    () => [...stylists].sort((a, b) => compare(a, b, sort)),
    [stylists, sort]
  );

  // 「実際に変更された」行 = edits map のキー
  const dirtyCount = Object.keys(edits).length;

  const valueOf = (s: Stylist, field: EditField) => {
    const override = edits[s.id]?.[field];
    return override !== undefined ? override : s[field];
  };

  const setEdit = (id: string, field: EditField, value: unknown) => {
    const original = stylistsById[id];
    if (!original) return;
    setEdits((prev) => {
      const next = { ...prev };
      const rowEdits = { ...(next[id] ?? {}) };
      if (original[field] === value) {
        // 元の値に戻された → 編集から外す
        delete rowEdits[field];
      } else {
        // @ts-expect-error: field は contractStatus | featuredFlag のいずれか
        rowEdits[field] = value;
      }
      if (Object.keys(rowEdits).length === 0) {
        delete next[id];
      } else {
        next[id] = rowEdits;
      }
      return next;
    });
  };

  const enterEditMode = () => {
    setEditMode(true);
    setFeedback(null);
  };

  const cancelEdit = () => {
    if (dirtyCount > 0 && !confirm(`${dirtyCount} 件の変更を破棄しますか？`)) return;
    setEdits({});
    setEditMode(false);
    setFeedback(null);
  };

  const commitEdits = () => {
    const payload: StylistEdit[] = Object.entries(edits).map(([id, changes]) => ({
      id,
      ...changes,
    }));
    if (payload.length === 0) {
      setFeedback("変更がありません");
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await applyStylistEdits(payload);
      if (!result.ok) {
        setFeedback(`失敗: ${result.reason}`);
        return;
      }
      const msg =
        result.failedIds.length > 0
          ? `${result.updatedCount} 件成功 / ${result.failedIds.length} 件失敗 (${result.failedIds.join(", ")})`
          : `${result.updatedCount} 件を更新しました`;
      setFeedback(msg);
      setEdits({});
      setEditMode(false);
      router.refresh();
    });
  };

  const onSortChange = (value: string) => {
    const url = new URL(window.location.href);
    if (value === "id") url.searchParams.delete("sort");
    else url.searchParams.set("sort", value);
    router.push(url.pathname + url.search);
  };

  return (
    <>
      {/* コントロールバー: 編集モード切替 + ソート */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-pomie-200">
        {!editMode ? (
          <button
            type="button"
            onClick={enterEditMode}
            className="rounded-full bg-pomie-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-pomie-600"
          >
            ✎ 一括編集
          </button>
        ) : (
          <>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              編集モード
            </span>
            <span className="text-xs text-ink-700">
              <strong className="text-pomie-700">{dirtyCount}</strong> 件変更中
            </span>
            <button
              type="button"
              onClick={commitEdits}
              disabled={pending || dirtyCount === 0}
              className="rounded-full bg-pomie-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-pomie-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "更新中..." : "一括更新"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="rounded-full border border-ink-100 bg-white px-4 py-1.5 text-sm font-semibold text-ink-700 transition hover:bg-pomie-100 disabled:opacity-60"
            >
              キャンセル
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-semibold text-ink-700">並び順</label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            disabled={editMode}
            className="rounded-lg border border-ink-100 bg-white px-2 py-1 text-xs disabled:opacity-50"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {feedback}
        </div>
      )}

      <section className="mt-3 space-y-3">
        {sorted.map((s) => {
          const store = storesById[s.storeId];
          const dirty = Boolean(edits[s.id]);
          const currentContract = valueOf(s, "contractStatus") as
            | "active"
            | "inactive";
          const currentFeatured = valueOf(s, "featuredFlag") as boolean;
          return (
            <article
              key={s.id}
              className={`card p-4 md:p-5 transition ${
                dirty ? "ring-2 ring-amber-400" : ""
              }`}
            >
              <div className="flex flex-wrap items-start gap-4">
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
                    {!editMode && (
                      <>
                        <ContractBadge status={currentContract} />
                        {currentFeatured && <FeaturedBadge />}
                      </>
                    )}
                    {dirty && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        未保存
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-ink-500">{s.id}</p>
                  <div className="mt-2 grid gap-2 text-xs md:grid-cols-4">
                    <Field label="店舗">{store?.name ?? "-"}</Field>
                    <Field label="エリア">{s.area || "—"}</Field>
                    <Field label="評価 / 施術数">
                      ★ {s.rating.toFixed(1)} / {s.worksCount} 件
                    </Field>
                    <Field label="得意メニュー">
                      {s.menus.slice(0, 2).map((m) => m.name).join(" / ") || "-"}
                    </Field>
                  </div>

                  {editMode && (
                    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-amber-50/60 p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <label className="font-semibold text-ink-700">公開状態:</label>
                        <select
                          value={currentContract}
                          onChange={(e) =>
                            setEdit(s.id, "contractStatus", e.target.value)
                          }
                          className="rounded border border-ink-100 bg-white px-2 py-1 text-xs"
                        >
                          <option value="active">掲載中（公開）</option>
                          <option value="inactive">停止中（非公開）</option>
                        </select>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-ink-700">
                        <input
                          type="checkbox"
                          checked={currentFeatured}
                          onChange={(e) =>
                            setEdit(s.id, "featuredFlag", e.target.checked)
                          }
                        />
                        注目美容師として表示
                      </label>
                    </div>
                  )}

                  {!editMode && s.instagramHandle && (
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

              {!editMode && (
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
                  <span className="ml-auto inline-flex items-center gap-2 text-ink-500">
                    予約可能枠:{" "}
                    <strong className={s.availableTimeSlots.length === 0 ? "text-red-600" : "text-ink-900"}>
                      {s.availableTimeSlots.length} 件
                    </strong>
                    <RegenerateSlotsButton stylistId={s.id} />
                  </span>
                  {s.contractStatus === "inactive" && (
                    <span className="text-ink-500">
                      （停止中のため公開ページは表示されません）
                    </span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </>
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
