"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Store, Stylist, StylistMenu } from "@/lib/types";
import { createStylist } from "@/server/actions/createStylist";
import { updateStylist } from "@/server/actions/updateStylist";
import {
  DEFAULT_MENU_DURATIONS,
  DURATION_OPTIONS,
  formatDuration,
} from "@/lib/menuDurations";
import { generateDummyAvailableSlots } from "@/lib/generateDummySlots";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import { TagInput } from "@/components/admin/TagInput";
import {
  STRENGTH_SUGGESTIONS,
  SPECIALTY_MENU_SUGGESTIONS,
} from "@/lib/stylistSuggestions";

const REASON_LABELS: Record<string, string> = {
  missing_name: "名前を入力してください",
  missing_store: "店舗を選んでください",
  missing_profile: "プロフィールを入力してください",
  missing_menus: "得意メニューを 1 つ以上入力してください",
  invalid_menus: "メニュー名と施術時間を正しく入力してください",
  invalid_price_range: "料金（最低・最高）を正しく入力してください",
  stylist_not_found: "対象の美容師が見つかりません",
};

type MenuRow = { name: string; duration: number };

const MENU_SUGGESTIONS = Object.keys(DEFAULT_MENU_DURATIONS);

export type LockedStylistField =
  | "storeId"
  | "contractStatus"
  | "featuredFlag";

export function StylistForm({
  stores,
  mode = "create",
  initialValues,
  lockedFields = [],
  cancelHref = "/admin/stylists",
  successHref = "/admin/stylists",
}: {
  stores: Store[];
  mode?: "create" | "edit";
  initialValues?: Stylist;
  /** 美容師本人の編集など、特定フィールドをロックしたい場合 */
  lockedFields?: LockedStylistField[];
  cancelHref?: string;
  successHref?: string;
}) {
  const isLocked = (f: LockedStylistField) => lockedFields.includes(f);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialMenus: MenuRow[] =
    initialValues?.menus.map((m) => ({ name: m.name, duration: m.duration })) ?? [
      { name: "", duration: 60 },
    ];

  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    nameKana: initialValues?.nameKana ?? "",
    avatar: initialValues?.avatar ?? "",
    storeId: initialValues?.storeId ?? stores[0]?.id ?? "",
    profile: initialValues?.profile ?? "",
    priceMin: initialValues?.priceRange.min.toString() ?? "7000",
    priceMax: initialValues?.priceRange.max.toString() ?? "20000",
    instagramHandle: initialValues?.instagramHandle ?? "",
    contractStatus: (initialValues?.contractStatus ?? "active") as "active" | "inactive",
    featuredFlag: initialValues?.featuredFlag ?? false,
  });
  const [menus, setMenus] = useState<MenuRow[]>(initialMenus);
  const [strengths, setStrengths] = useState<string[]>(initialValues?.strengths ?? []);
  const [specialtyMenus, setSpecialtyMenus] = useState<string[]>(
    initialValues?.specialtyMenus ?? []
  );
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>(
    initialValues?.availableTimeSlots ??
      generateDummyAvailableSlots("draft", 8)
  );

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const updateMenu = (i: number, patch: Partial<MenuRow>) => {
    setMenus((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    );
  };
  const removeMenu = (i: number) => {
    setMenus((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addMenu = () => {
    setMenus((prev) => [...prev, { name: "", duration: 60 }]);
  };
  const onMenuNameBlur = (i: number, name: string) => {
    // 既定マップに名前が一致したら、自動で時間を補完（既存の値は尊重）
    const trimmed = name.trim();
    if (!trimmed) return;
    const def = DEFAULT_MENU_DURATIONS[trimmed];
    if (def && menus[i].duration === 60) {
      updateMenu(i, { duration: def });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedMenus: StylistMenu[] = menus
      .map((m) => ({ name: m.name.trim(), duration: Number(m.duration) }))
      .filter((m) => m.name.length > 0);

    if (cleanedMenus.length === 0) {
      setError(REASON_LABELS.missing_menus);
      return;
    }
    if (cleanedMenus.some((m) => !m.duration || m.duration <= 0)) {
      setError(REASON_LABELS.invalid_menus);
      return;
    }

    const priceMin = parseInt(form.priceMin, 10);
    const priceMax = parseInt(form.priceMax, 10);
    if (
      Number.isNaN(priceMin) ||
      Number.isNaN(priceMax) ||
      priceMin < 0 ||
      priceMax < priceMin
    ) {
      setError(REASON_LABELS.invalid_price_range);
      return;
    }

    const payload = {
      name: form.name,
      nameKana: form.nameKana,
      avatar: form.avatar,
      storeId: form.storeId,
      profile: form.profile,
      strengths,
      specialtyMenus,
      menus: cleanedMenus,
      priceRange: { min: priceMin, max: priceMax },
      availableTimeSlots,
      instagramHandle: form.instagramHandle,
      contractStatus: form.contractStatus,
      featuredFlag: form.featuredFlag,
    };

    startTransition(async () => {
      const result =
        mode === "edit" && initialValues
          ? await updateStylist({ ...payload, id: initialValues.id })
          : await createStylist(payload);

      if (result.ok) {
        router.push(successHref);
        router.refresh();
      } else {
        setError(REASON_LABELS[result.reason] ?? `保存に失敗しました (${result.reason})`);
      }
    });
  };

  const ctaLabel =
    mode === "edit"
      ? pending
        ? "保存中..."
        : "変更を保存"
      : pending
        ? "登録中..."
        : "登録する";

  const totalDuration = menus
    .filter((m) => m.name.trim())
    .reduce((sum, m) => sum + (Number(m.duration) || 0), 0);

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="名前" required>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="例: 山田 太郎"
            className="input"
          />
        </Field>
        <Field label="名前カナ">
          <input
            value={form.nameKana}
            onChange={(e) => update("nameKana", e.target.value)}
            placeholder="例: ヤマダ タロウ"
            className="input"
          />
        </Field>
      </div>

      <Field label="所属店舗" required>
        {isLocked("storeId") ? (
          <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-100/40 px-3 py-2 text-sm">
            <span>
              {stores.find((s) => s.id === form.storeId)?.name ?? "-"}
              <span className="ml-1 text-ink-500">
                （{stores.find((s) => s.id === form.storeId)?.area ?? ""}）
              </span>
            </span>
            <span className="ml-auto text-[10px] text-ink-500">
              変更は POMiE 担当者まで
            </span>
          </div>
        ) : (
          <select
            value={form.storeId}
            onChange={(e) => update("storeId", e.target.value)}
            className="input"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.area}）
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="プロフィール" required>
        <textarea
          value={form.profile}
          onChange={(e) => update("profile", e.target.value)}
          rows={4}
          placeholder="得意分野・経験・想いなど"
          className="input"
        />
      </Field>

      {/* 強み（表示用キャッチフレーズ） */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink-700">
          強み
          <span className="ml-2 font-normal text-ink-500">
            ({strengths.length} 件) — 美容師詳細・カードに表示
          </span>
        </legend>
        <TagInput
          value={strengths}
          onChange={setStrengths}
          suggestions={STRENGTH_SUGGESTIONS}
          placeholder="例: 髪質改善のプロ"
        />
      </fieldset>

      {/* 得意メニュー（表示用タグ） */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink-700">
          得意メニュー（表示用）
          <span className="ml-2 font-normal text-ink-500">
            ({specialtyMenus.length} 件) — 一覧・詳細のタグ表示用
          </span>
        </legend>
        <TagInput
          value={specialtyMenus}
          onChange={setSpecialtyMenus}
          suggestions={SPECIALTY_MENU_SUGGESTIONS}
          placeholder="例: ハイライト"
        />
        <p className="text-[11px] text-ink-500">
          ※ 実際に予約できるメニューと施術時間は、下の「予約可能メニュー」で管理します。
        </p>
      </fieldset>

      {/* 予約可能メニュー入力（テーブル状） */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink-700">
          予約可能メニュー <span className="text-pomie-600">*</span>
          <span className="ml-2 font-normal text-ink-500">
            ({menus.filter((m) => m.name.trim()).length} 件 / 合計 {formatDuration(totalDuration)})
            — 予約フォームの選択肢になる
          </span>
        </legend>
        <div className="overflow-hidden rounded-lg border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-pomie-50 text-xs text-ink-700">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">メニュー名</th>
                <th className="px-3 py-2 text-left font-semibold">施術時間</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m, i) => (
                <tr key={i} className="border-t border-ink-100/70">
                  <td className="px-3 py-2">
                    <input
                      value={m.name}
                      onChange={(e) => updateMenu(i, { name: e.target.value })}
                      onBlur={(e) => onMenuNameBlur(i, e.target.value)}
                      list="menu-suggestions"
                      placeholder="例: カット / 髪質改善"
                      className="input"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.duration}
                      onChange={(e) =>
                        updateMenu(i, { duration: Number(e.target.value) })
                      }
                      className="input"
                    >
                      {DURATION_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {formatDuration(d)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeMenu(i)}
                      disabled={menus.length === 1}
                      title="この行を削除"
                      className="text-ink-500 hover:text-red-600 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="menu-suggestions">
          {MENU_SUGGESTIONS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={addMenu}
          className="text-xs font-semibold text-pomie-600 hover:text-pomie-700"
        >
          + メニューを追加
        </button>
        <p className="text-xs text-ink-500">
          名前を入力すると施術時間が自動補完される場合があります（既定 60 分）。後でいつでも調整可能。
        </p>
      </fieldset>

      {/* スケジュール */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink-700">スケジュール</legend>
        <ScheduleEditor
          value={availableTimeSlots}
          onChange={setAvailableTimeSlots}
          seedId={initialValues?.id ?? "draft"}
        />
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="料金 最低（円）" required>
          <input
            type="number"
            min={0}
            value={form.priceMin}
            onChange={(e) => update("priceMin", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="料金 最高（円）" required>
          <input
            type="number"
            min={0}
            value={form.priceMax}
            onChange={(e) => update("priceMax", e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <Field label="Instagram ハンドル">
        <input
          value={form.instagramHandle}
          onChange={(e) => update("instagramHandle", e.target.value)}
          placeholder="例: jima211 (@ は不要)"
          className="input"
        />
        <p className="mt-1 text-xs text-ink-500">
          {mode === "edit"
            ? "ハンドルを変更すると保存時に最新 8 投稿を自動で再取得します。"
            : "登録後、自動で最新 8 投稿の取得を試みます。トークン未設定時はモック投稿が入ります。"}
        </p>
      </Field>

      <Field label="アバター画像 URL">
        <input
          value={form.avatar}
          onChange={(e) => update("avatar", e.target.value)}
          placeholder="例: https://... (空欄なら自動補完)"
          className="input"
        />
        <p className="mt-1 text-xs text-ink-500">
          空欄なら IG ハンドルから自動取得（unavatar.io）→ それも失敗時はイニシャル表示。<br />
          <strong className="text-red-600">Instagram の画像 URL（cdninstagram.com）を直接貼ると表示できません</strong>
          （ホットリンク防止＆有効期限トークンのため）。
          実際の画像を出したい場合は Imgur / Cloudinary 等の画像ホスト URL を貼ってください。
        </p>
      </Field>

      <div className="flex flex-wrap items-center gap-6">
        {isLocked("contractStatus") ? (
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span className="font-semibold text-ink-700">契約状態:</span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                form.contractStatus === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-ink-100 text-ink-500"
              }`}
            >
              {form.contractStatus === "active" ? "掲載中" : "停止中"}
            </span>
            <span>（POMiE 担当者のみ変更可）</span>
          </div>
        ) : (
          <fieldset>
            <legend className="text-xs font-semibold text-ink-700">契約状態</legend>
            <div className="mt-1 flex gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="contractStatus"
                  checked={form.contractStatus === "active"}
                  onChange={() => update("contractStatus", "active")}
                />
                掲載中（公開）
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="contractStatus"
                  checked={form.contractStatus === "inactive"}
                  onChange={() => update("contractStatus", "inactive")}
                />
                停止中（非公開）
              </label>
            </div>
          </fieldset>
        )}
        {!isLocked("featuredFlag") && (
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={form.featuredFlag}
              onChange={(e) => update("featuredFlag", e.target.checked)}
            />
            注目美容師として表示
          </label>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {ctaLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          disabled={pending}
          className="btn-secondary"
        >
          キャンセル
        </button>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #ececec;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: #fff;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #d68a55;
          box-shadow: 0 0 0 2px rgba(241, 199, 163, 0.5);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">
        {label}
        {required && <span className="ml-1 text-pomie-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
