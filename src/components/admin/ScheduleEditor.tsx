"use client";

import { useMemo, useState } from "react";
import { generateDummyAvailableSlots } from "@/lib/generateDummySlots";
import { formatDuration } from "@/lib/menuDurations";

const HOURS = [10, 11, 13, 14, 15, 16, 17, 18];
const DAYS_AHEAD = 14;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIso(date: Date, hour: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

type ViewMode = "grid" | "cards";

export function ScheduleEditor({
  value,
  onChange,
  seedId,
}: {
  value: string[];
  onChange: (slots: string[]) => void;
  seedId: string;
}) {
  const [view, setView] = useState<ViewMode>("grid");
  const [extraDates, setExtraDates] = useState<Set<string>>(new Set());
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  // 共通の日付配列（翌日〜DAYS_AHEAD 日先）
  const dateRange = useMemo(() => {
    const arr: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 1; i <= DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const totalCount = value.length;
  const totalMinutes = totalCount * 60;

  // ===== Toggle helpers =====
  const toggleSlot = (iso: string) => {
    if (selectedSet.has(iso)) {
      onChange(value.filter((s) => s !== iso));
    } else {
      onChange([...value, iso]);
    }
  };

  const toggleDate = (date: Date) => {
    const dateSlots = HOURS.map((h) => toIso(date, h));
    const allOn = dateSlots.every((s) => selectedSet.has(s));
    if (allOn) {
      onChange(value.filter((s) => !dateSlots.includes(s)));
    } else {
      const merged = new Set(value);
      for (const s of dateSlots) merged.add(s);
      onChange(Array.from(merged));
    }
  };

  const toggleHourColumn = (hour: number) => {
    const colSlots = dateRange.map((d) => toIso(d, hour));
    const allOn = colSlots.every((s) => selectedSet.has(s));
    if (allOn) {
      onChange(value.filter((s) => !colSlots.includes(s)));
    } else {
      const merged = new Set(value);
      for (const s of colSlots) merged.add(s);
      onChange(Array.from(merged));
    }
  };

  // ===== Bulk actions =====
  const selectAll = () => {
    const all: string[] = [];
    for (const d of dateRange) for (const h of HOURS) all.push(toIso(d, h));
    onChange(all);
  };
  const clearAll = () => onChange([]);
  const fillWithDummy = () => onChange(generateDummyAvailableSlots(seedId, 8));

  // ===== Card view 用 =====
  // 表示する日付 = value にある日 ∪ extraDates
  const cardDateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of value) set.add(s.slice(0, 10));
    for (const k of extraDates) set.add(k);
    return Array.from(set).sort();
  }, [value, extraDates]);

  // 「+ 日付を追加」候補 = dateRange のうち cardDateKeys に無いもの
  const addableDates = useMemo(() => {
    const set = new Set(cardDateKeys);
    return dateRange.filter((d) => !set.has(dateKey(d)));
  }, [dateRange, cardDateKeys]);

  const removeCardDate = (key: string) => {
    setExtraDates((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    onChange(value.filter((s) => !s.startsWith(key)));
  };

  const addCardDate = (key: string) => {
    setExtraDates((prev) => new Set([...prev, key]));
    setAddPickerOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-full bg-pomie-100 px-3 py-1 text-xs font-semibold text-pomie-700">
          予約可能枠: {totalCount} 件
          <span className="ml-1 text-pomie-700/60">({formatDuration(totalMinutes)})</span>
        </div>
        <div className="ml-auto inline-flex overflow-hidden rounded-full ring-1 ring-pomie-200">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`px-3 py-1 text-xs font-semibold ${
              view === "grid"
                ? "bg-pomie-500 text-white"
                : "bg-white text-ink-700 hover:bg-pomie-100"
            }`}
          >
            カレンダー
          </button>
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`px-3 py-1 text-xs font-semibold ${
              view === "cards"
                ? "bg-pomie-500 text-white"
                : "bg-white text-ink-700 hover:bg-pomie-100"
            }`}
          >
            日付別
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={selectAll}
          className="rounded-full border border-ink-100 bg-white px-3 py-1 font-semibold text-ink-700 hover:bg-pomie-100"
        >
          全選択
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border border-ink-100 bg-white px-3 py-1 font-semibold text-ink-700 hover:bg-pomie-100"
        >
          全クリア
        </button>
        <button
          type="button"
          onClick={fillWithDummy}
          className="rounded-full border border-ink-100 bg-white px-3 py-1 font-semibold text-ink-700 hover:bg-pomie-100"
        >
          ダミーで埋め直す（8 枠）
        </button>
      </div>

      {/* ビュー */}
      {view === "grid" ? (
        <GridView
          dateRange={dateRange}
          selectedSet={selectedSet}
          onToggleSlot={toggleSlot}
          onToggleDate={toggleDate}
          onToggleHour={toggleHourColumn}
        />
      ) : (
        <CardsView
          cardDateKeys={cardDateKeys}
          selectedSet={selectedSet}
          onToggleSlot={toggleSlot}
          onToggleDate={toggleDate}
          onRemoveDate={removeCardDate}
          addableDates={addableDates}
          onAddDate={addCardDate}
          addPickerOpen={addPickerOpen}
          setAddPickerOpen={setAddPickerOpen}
        />
      )}
    </div>
  );
}

// ============================
// A: カレンダーグリッド
// ============================
function GridView({
  dateRange,
  selectedSet,
  onToggleSlot,
  onToggleDate,
  onToggleHour,
}: {
  dateRange: Date[];
  selectedSet: Set<string>;
  onToggleSlot: (iso: string) => void;
  onToggleDate: (date: Date) => void;
  onToggleHour: (hour: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-ink-100">
      <table className="min-w-full text-xs">
        <thead className="bg-pomie-50">
          <tr>
            <th className="sticky left-0 z-10 bg-pomie-50 px-2 py-1.5 text-left font-semibold text-ink-700">
              日付
            </th>
            {HOURS.map((h) => (
              <th
                key={h}
                className="px-1 py-1.5 text-center font-semibold text-ink-700 hover:bg-pomie-100"
              >
                <button
                  type="button"
                  onClick={() => onToggleHour(h)}
                  title={`${h}:00 を全日切替`}
                  className="w-full"
                >
                  {h}:00
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dateRange.map((d) => {
            const dateSlots = HOURS.map((h) => toIso(d, h));
            const onCount = dateSlots.filter((s) => selectedSet.has(s)).length;
            return (
              <tr key={dateKey(d)} className="border-t border-ink-100/70">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleDate(d)}
                    title="この日全体を切替"
                    className="text-left font-medium hover:text-pomie-600"
                  >
                    {dateLabel(d)}
                    <span className="ml-1 text-[10px] text-ink-500">{onCount}/8</span>
                  </button>
                </td>
                {HOURS.map((h) => {
                  const iso = toIso(d, h);
                  const on = selectedSet.has(iso);
                  return (
                    <td key={h} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => onToggleSlot(iso)}
                        className={`h-7 w-7 rounded-full text-[11px] transition ${
                          on
                            ? "bg-pomie-500 text-white shadow-sm hover:bg-pomie-600"
                            : "bg-ink-100/40 text-ink-300 hover:bg-pomie-100"
                        }`}
                      >
                        {on ? "●" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================
// B: 日付別カード
// ============================
function CardsView({
  cardDateKeys,
  selectedSet,
  onToggleSlot,
  onToggleDate,
  onRemoveDate,
  addableDates,
  onAddDate,
  addPickerOpen,
  setAddPickerOpen,
}: {
  cardDateKeys: string[];
  selectedSet: Set<string>;
  onToggleSlot: (iso: string) => void;
  onToggleDate: (date: Date) => void;
  onRemoveDate: (key: string) => void;
  addableDates: Date[];
  onAddDate: (key: string) => void;
  addPickerOpen: boolean;
  setAddPickerOpen: (open: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {cardDateKeys.length === 0 && !addPickerOpen && (
        <div className="rounded-lg bg-pomie-50 p-4 text-center text-xs text-ink-500">
          まだ日付が追加されていません。下のボタンから追加してください。
        </div>
      )}

      {cardDateKeys.map((key) => {
        const d = parseDateKey(key);
        const dateSlots = HOURS.map((h) => toIso(d, h));
        const onCount = dateSlots.filter((s) => selectedSet.has(s)).length;
        return (
          <div key={key} className="rounded-lg bg-white p-3 ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleDate(d)}
                title="この日全体を切替"
                className="text-sm font-bold hover:text-pomie-600"
              >
                {dateLabel(d)}
              </button>
              <span className="text-[11px] text-ink-500">{onCount}/8</span>
              <button
                type="button"
                onClick={() => onRemoveDate(key)}
                className="ml-auto text-[11px] text-ink-500 hover:text-red-600"
              >
                この日を削除
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HOURS.map((h) => {
                const iso = toIso(d, h);
                const on = selectedSet.has(iso);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onToggleSlot(iso)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      on
                        ? "bg-pomie-500 text-white shadow-sm"
                        : "bg-white text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
                    }`}
                  >
                    {on && <span className="mr-0.5">●</span>}
                    {h}:00
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 日付追加 */}
      {addPickerOpen ? (
        <div className="rounded-lg bg-pomie-50 p-3 ring-1 ring-pomie-200">
          <p className="mb-2 text-xs font-semibold text-pomie-700">追加する日付を選択:</p>
          <div className="flex flex-wrap gap-1.5">
            {addableDates.length === 0 && (
              <p className="text-xs text-ink-500">追加できる日付がありません（今後 14 日分すべて表示中）。</p>
            )}
            {addableDates.map((d) => (
              <button
                key={dateKey(d)}
                type="button"
                onClick={() => onAddDate(dateKey(d))}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
              >
                {dateLabel(d)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAddPickerOpen(false)}
            className="mt-2 text-[11px] text-ink-500 hover:text-ink-700"
          >
            キャンセル
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddPickerOpen(true)}
          className="rounded-full border border-dashed border-pomie-300 bg-white px-4 py-2 text-xs font-semibold text-pomie-600 hover:bg-pomie-100"
        >
          + 日付を追加
        </button>
      )}
    </div>
  );
}
