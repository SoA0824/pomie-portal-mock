"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BookingLink,
  BookingMode,
  Store,
  Stylist,
  StylistMenu,
} from "@/lib/types";
import { createStylist } from "@/server/actions/createStylist";
import { updateStylist } from "@/server/actions/updateStylist";
import {
  DEFAULT_MENU_DURATIONS,
  DURATION_OPTIONS,
  formatDuration,
} from "@/lib/menuDurations";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { TagInput } from "@/components/admin/TagInput";
import {
  STRENGTH_SUGGESTIONS,
  SPECIALTY_MENU_SUGGESTIONS,
} from "@/lib/stylistSuggestions";

const REASON_LABELS: Record<string, string> = {
  missing_name: "名前を入力してください",
  missing_store: "店舗を選んでください",
  missing_profile: "プロフィールを入力してください",
  missing_booking_links:
    "「美容師独自受付」を選んだ場合は、予約リンクを 1 つ以上（表示テキストと URL の両方）入力してください",
  missing_menus: "「予約可能メニュー」を 1 つ以上入力してください（メニュー名が必要です）",
  invalid_menus: "「予約可能メニュー」の施術時間を正しく設定してください",
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
    backgroundImage: initialValues?.backgroundImage ?? "",
    contractStatus: (initialValues?.contractStatus ?? "active") as "active" | "inactive",
    featuredFlag: initialValues?.featuredFlag ?? false,
  });
  const [menus, setMenus] = useState<MenuRow[]>(initialMenus);
  const [strengths, setStrengths] = useState<string[]>(initialValues?.strengths ?? []);
  const [specialtyMenus, setSpecialtyMenus] = useState<string[]>(
    initialValues?.specialtyMenus ?? []
  );
  // 新規登録時は空から開始（ダミー枠は入れない）
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>(
    initialValues?.availableTimeSlots ?? []
  );
  // 料金「指定なし」: min/max ともに 0 なら未設定扱い
  const [priceUnspecified, setPriceUnspecified] = useState<boolean>(
    initialValues
      ? !(initialValues.priceRange.min > 0 || initialValues.priceRange.max > 0)
      : false
  );
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    initialValues?.bookingMode ?? "external"
  );
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>(
    initialValues?.bookingLinks && initialValues.bookingLinks.length > 0
      ? initialValues.bookingLinks
      : [{ label: "", url: "" }]
  );

  const updateBookingLink = (i: number, patch: Partial<BookingLink>) => {
    setBookingLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setError(null);
  };
  const addBookingLink = () =>
    setBookingLinks((prev) => [...prev, { label: "", url: "" }]);
  const removeBookingLink = (i: number) =>
    setBookingLinks((prev) => prev.filter((_, idx) => idx !== i));

  // 予約可能メニュー欄でエラーが起きているか（赤枠表示に使う）
  const menuError =
    error === REASON_LABELS.missing_menus || error === REASON_LABELS.invalid_menus;

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
    setError(null); // 入力を直したらエラー表示を消す
  };

  const updateMenu = (i: number, patch: Partial<MenuRow>) => {
    setMenus((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    );
    setError(null);
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

    // 「指定なし」の場合は 0 として保存（表示側で「指定なし」と出す）
    const priceMin = priceUnspecified ? 0 : parseInt(form.priceMin, 10);
    const priceMax = priceUnspecified ? 0 : parseInt(form.priceMax, 10);
    if (
      Number.isNaN(priceMin) ||
      Number.isNaN(priceMax) ||
      priceMin < 0 ||
      priceMax < priceMin
    ) {
      setError(REASON_LABELS.invalid_price_range);
      return;
    }

    const cleanedBookingLinks: BookingLink[] = bookingLinks
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label && l.url);

    if (bookingMode === "external" && cleanedBookingLinks.length === 0) {
      setError(REASON_LABELS.missing_booking_links);
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
      backgroundImage: form.backgroundImage,
      bookingMode,
      bookingLinks: cleanedBookingLinks,
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
          <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-normal text-ink-500">
            任意
          </span>
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
          <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-normal text-ink-500">
            任意
          </span>
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

      {/* 予約受け付け導線 */}
      <fieldset className="space-y-3 rounded-lg bg-pomie-50/60 p-4">
        <legend className="text-xs font-semibold text-ink-700">
          予約受け付け導線
          <span className="ml-1.5 rounded bg-pomie-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            必須
          </span>
        </legend>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="bookingMode"
              className="mt-1"
              checked={bookingMode === "external"}
              onChange={() => {
                setBookingMode("external");
                setError(null);
              }}
            />
            <span>
              <span className="font-semibold">美容師独自受付</span>
              <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
                現在の推奨
              </span>
              <span className="block text-xs text-ink-500">
                Web フォーム・Instagram DM など、美容師ごとの受付先へリンクします
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="bookingMode"
              className="mt-1"
              checked={bookingMode === "pomie"}
              onChange={() => {
                setBookingMode("pomie");
                setError(null);
              }}
            />
            <span>
              <span className="font-semibold">POMiE システム受付</span>
              <span className="block text-xs text-ink-500">
                ポータル内の「Web で予約」「LINE で予約」を表示します
                （最終版の予約導線が完成してから使用）
              </span>
            </span>
          </label>
        </div>

        {bookingMode === "external" && (
          <div className="space-y-2 border-t border-pomie-200/60 pt-3">
            <p className="text-xs font-semibold text-ink-700">
              予約リンク
              <span className="ml-2 font-normal text-ink-500">
                （{bookingLinks.filter((l) => l.label.trim() && l.url.trim()).length} 件）
                — 美容師詳細ページにボタンとして表示
              </span>
            </p>
            {bookingLinks.map((link, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                <input
                  value={link.label}
                  onChange={(e) => updateBookingLink(i, { label: e.target.value })}
                  placeholder="ボタン表示テキスト（例: Web フォームで予約）"
                  className="input"
                />
                <input
                  value={link.url}
                  onChange={(e) => updateBookingLink(i, { url: e.target.value })}
                  placeholder="https://..."
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => removeBookingLink(i)}
                  disabled={bookingLinks.length === 1}
                  title="この行を削除"
                  className="px-2 text-ink-500 hover:text-red-600 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addBookingLink}
              className="text-xs font-semibold text-pomie-600 hover:text-pomie-700"
            >
              + 予約リンクを追加
            </button>
            <p className="text-[11px] text-ink-500">
              1 つ目のリンクが目立つボタン、2 つ目以降は補助ボタンとして表示されます。
              Instagram DM は <code>https://www.instagram.com/ユーザー名/</code> などを指定してください。
            </p>
          </div>
        )}
      </fieldset>

      {/* 予約可能メニュー入力（テーブル状） */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink-700">
          予約可能メニュー
          <span className="ml-1.5 rounded bg-pomie-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            必須
          </span>
          <span className="ml-2 font-normal text-ink-500">
            ({menus.filter((m) => m.name.trim()).length} 件 / 合計 {formatDuration(totalDuration)})
            — 予約フォームの選択肢になる
          </span>
        </legend>
        <div
          className={`overflow-hidden rounded-lg border ${
            menuError ? "border-red-400 ring-2 ring-red-100" : "border-ink-100"
          }`}
        >
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
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink-700">料金目安</legend>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={priceUnspecified}
            onChange={(e) => {
              setPriceUnspecified(e.target.checked);
              setError(null);
            }}
          />
          指定なし（料金を公開しない）
        </label>
        {!priceUnspecified && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="料金 最低（円）">
              <input
                type="number"
                min={0}
                value={form.priceMin}
                onChange={(e) => update("priceMin", e.target.value)}
                className="input"
              />
            </Field>
            <Field label="料金 最高（円）">
              <input
                type="number"
                min={0}
                value={form.priceMax}
                onChange={(e) => update("priceMax", e.target.value)}
                className="input"
              />
            </Field>
          </div>
        )}
        <p className="text-[11px] text-ink-500">
          「指定なし」にすると、公開ページの料金目安が「指定なし」と表示されます。
          片方だけ 0 にすると「¥7,000〜」「〜¥20,000」のような片側表示になります。
        </p>
      </fieldset>

      <Field label="Instagram ハンドル">
        <input
          value={form.instagramHandle}
          onChange={(e) => update("instagramHandle", e.target.value)}
          placeholder="例: sharesalonpomie (@ は不要)"
          className="input"
        />
        <p className="mt-1 text-xs text-ink-500">
          {mode === "edit"
            ? "ハンドルを変更すると保存時に最新 8 投稿を自動で再取得します。"
            : "登録後、自動で最新 8 投稿の取得を試みます。"}
        </p>
      </Field>

      <Field label="アバター画像">
        <ImageUploadField
          value={form.avatar}
          onChange={(url) => update("avatar", url)}
          folder="avatars"
          previewShape="square"
        />
        <p className="mt-1 text-xs text-ink-500">
          空欄の場合は名前のイニシャルを表示します。
          Instagram の画像は保存してからアップロードしてください
          （<code>cdninstagram.com</code> の URL は直接貼っても表示できません）。
        </p>
      </Field>

      <Field label="詳細ページの背景画像">
        <ImageUploadField
          value={form.backgroundImage}
          onChange={(url) => update("backgroundImage", url)}
          folder="backgrounds"
          previewShape="wide"
        />
        <p className="mt-1 text-xs text-ink-500">
          美容師詳細ページ上部にぼかして敷く背景画像。
          <strong>空欄なら所属店舗のメイン写真を使用</strong>します。
          店舗の内装など「引き」の写真がおすすめです。
        </p>
      </Field>

      <div className="space-y-4 border-t border-ink-100 pt-4">
        {isLocked("contractStatus") ? (
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span className="font-semibold text-ink-700">公開状態:</span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                form.contractStatus === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-ink-100 text-ink-500"
              }`}
            >
              {form.contractStatus === "active" ? "公開" : "非公開"}
            </span>
            <span>（POMiE 担当者のみ変更可）</span>
          </div>
        ) : (
          <fieldset>
            <legend className="text-xs font-semibold text-ink-700">公開状態</legend>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="contractStatus"
                  checked={form.contractStatus === "active"}
                  onChange={() => update("contractStatus", "active")}
                />
                公開
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="contractStatus"
                  checked={form.contractStatus === "inactive"}
                  onChange={() => update("contractStatus", "inactive")}
                />
                非公開
              </label>
            </div>
          </fieldset>
        )}
        {!isLocked("featuredFlag") && (
          <div>
            <p className="text-xs font-semibold text-ink-700">おすすめ表示</p>
            <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={form.featuredFlag}
                onChange={(e) => update("featuredFlag", e.target.checked)}
              />
              注目美容師として表示（トップページに掲載）
            </label>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
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
        {pending && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-pomie-200 border-t-pomie-600" />
            保存しています...
          </span>
        )}
      </div>
      {form.instagramHandle.trim() && (
        <p className="text-[11px] text-ink-500">
          ※ Instagram の投稿取得は保存後、美容師一覧の画面で自動的に行われます（数十秒かかる場合があります）。
        </p>
      )}

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
