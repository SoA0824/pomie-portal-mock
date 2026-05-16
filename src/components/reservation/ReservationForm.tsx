"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Stylist, Store } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { createReservation } from "@/server/actions/createReservation";

const REASON_LABELS: Record<string, string> = {
  stylist_not_available: "選択された美容師は現在予約を受け付けていません。",
  store_not_found: "店舗情報が取得できませんでした。",
  stylist_slot_unavailable: "選択された日時は予約できません。",
  salonboard_unavailable: "サロンボード側で席が満席のため予約できません。別の日時をお選びください。",
  salonboard_forced_failure: "サロンボード連携に失敗しました（強制失敗フラグ）。",
  unknown_shop: "店舗情報がサロンボードに登録されていません。",
};

function reasonToLabel(reason: string): string {
  return REASON_LABELS[reason] ?? `予約に失敗しました (${reason})`;
}

export function ReservationForm({ stylist, store }: { stylist: Stylist; store: Store }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [form, setForm] = useState({
    desiredDateTime: stylist.availableTimeSlots[0] ?? "",
    menu: stylist.menus[0]?.name ?? "",
    customerName: "",
    customerContact: "",
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createReservation({
        stylistId: stylist.id,
        channel: "web",
        ...form,
      });
      if (result.ok) {
        router.push(`/reservations/${result.reservation.id}/complete`);
      } else {
        setError(reasonToLabel(result.reason));
      }
    });
  };

  if (stylist.availableTimeSlots.length === 0) {
    return (
      <div className="card p-6 text-sm text-ink-700">
        現在この美容師の予約枠はありません。別の美容師をお選びください。
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">予約内容の確認</h2>
        <dl className="space-y-2 text-sm">
          <Row k="美容師" v={`${stylist.name}（${store.name}）`} />
          <Row k="日時" v={formatDateTime(form.desiredDateTime)} />
          <Row k="メニュー" v={form.menu} />
          <Row k="お名前" v={form.customerName} />
          <Row k="ご連絡先" v={form.customerContact} />
        </dl>
        <p className="rounded-lg bg-pomie-100/60 p-3 text-xs text-pomie-700">
          確定すると、サロンボード（{store.salonboardShopId}）にも同時に席予約が登録されます。
        </p>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="btn-primary disabled:opacity-60"
          >
            {pending ? "予約中..." : "予約を確定する"}
          </button>
          <button
            type="button"
            onClick={() => setStep("input")}
            disabled={pending}
            className="btn-secondary"
          >
            内容を修正する
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.desiredDateTime || !form.menu || !form.customerName || !form.customerContact) {
          setError("すべての項目を入力してください。");
          return;
        }
        setError(null);
        setStep("confirm");
      }}
      className="card space-y-5 p-6"
    >
      <Field label="希望日時">
        <select
          value={form.desiredDateTime}
          onChange={(e) => update("desiredDateTime", e.target.value)}
          className="input"
        >
          {stylist.availableTimeSlots.map((slot) => (
            <option key={slot} value={slot}>
              {formatDateTime(slot)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="メニュー">
        <select
          value={form.menu}
          onChange={(e) => update("menu", e.target.value)}
          className="input"
        >
          {stylist.menus.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({m.duration}分)
            </option>
          ))}
        </select>
      </Field>
      <Field label="お名前">
        <input
          value={form.customerName}
          onChange={(e) => update("customerName", e.target.value)}
          placeholder="例: 山田 花子"
          className="input"
        />
      </Field>
      <Field label="ご連絡先（メールまたは電話）">
        <input
          value={form.customerContact}
          onChange={(e) => update("customerContact", e.target.value)}
          placeholder="例: hanako@example.com"
          className="input"
        />
        <p className="mt-1 text-xs text-ink-500">
          ※ 連絡先に「salonboard-fail」を含めると、サロンボード連携の失敗ハンドリングを検証できます（モック用）。
        </p>
      </Field>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button type="submit" className="btn-primary w-full md:w-auto">
        確認へ進む
      </button>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-100/70 pb-1.5">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right font-medium text-ink-900">{v}</dd>
    </div>
  );
}
