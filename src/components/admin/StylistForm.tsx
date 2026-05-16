"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Store, Stylist } from "@/lib/types";
import { createStylist } from "@/server/actions/createStylist";
import { updateStylist } from "@/server/actions/updateStylist";

const REASON_LABELS: Record<string, string> = {
  missing_name: "名前を入力してください",
  missing_store: "店舗を選んでください",
  missing_profile: "プロフィールを入力してください",
  missing_menus: "得意メニューを 1 つ以上入力してください",
  invalid_price_range: "料金（最低・最高）を正しく入力してください",
  stylist_not_found: "対象の美容師が見つかりません",
};

export function StylistForm({
  stores,
  mode = "create",
  initialValues,
}: {
  stores: Store[];
  mode?: "create" | "edit";
  initialValues?: Stylist;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    nameKana: initialValues?.nameKana ?? "",
    avatar: initialValues?.avatar ?? "",
    storeId: initialValues?.storeId ?? stores[0]?.id ?? "",
    profile: initialValues?.profile ?? "",
    menus: initialValues?.menus.join(", ") ?? "",
    priceMin: initialValues?.priceRange.min.toString() ?? "7000",
    priceMax: initialValues?.priceRange.max.toString() ?? "20000",
    instagramHandle: initialValues?.instagramHandle ?? "",
    contractStatus: (initialValues?.contractStatus ?? "active") as "active" | "inactive",
    featuredFlag: initialValues?.featuredFlag ?? false,
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const menus = form.menus
      .split(/[,、\n]/)
      .map((m) => m.trim())
      .filter(Boolean);

    if (menus.length === 0) {
      setError(REASON_LABELS.missing_menus);
      return;
    }
    const priceMin = parseInt(form.priceMin, 10);
    const priceMax = parseInt(form.priceMax, 10);
    if (Number.isNaN(priceMin) || Number.isNaN(priceMax) || priceMin < 0 || priceMax < priceMin) {
      setError(REASON_LABELS.invalid_price_range);
      return;
    }

    const payload = {
      name: form.name,
      nameKana: form.nameKana,
      avatar: form.avatar,
      storeId: form.storeId,
      profile: form.profile,
      menus,
      priceRange: { min: priceMin, max: priceMax },
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
        router.push(`/admin/stylists`);
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

      <Field label="得意メニュー（カンマ区切り）" required>
        <input
          value={form.menus}
          onChange={(e) => update("menus", e.target.value)}
          placeholder="例: 髪質改善, カラー, ハイライト"
          className="input"
        />
        <p className="mt-1 text-xs text-ink-500">複数入れる場合は「,」または改行で区切ってください。</p>
      </Field>

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
        <label className="inline-flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={form.featuredFlag}
            onChange={(e) => update("featuredFlag", e.target.checked)}
          />
          注目美容師として表示
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {ctaLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/stylists")}
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
