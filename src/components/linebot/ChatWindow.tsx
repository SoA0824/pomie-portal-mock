"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Stylist, Store } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { createReservation } from "@/server/actions/createReservation";

type Message =
  | { from: "bot"; kind: "text"; text: string }
  | { from: "bot"; kind: "card"; stylistName: string; storeName: string; rating: number; menus: string[] }
  | { from: "user"; kind: "text"; text: string };

type Step =
  | { name: "greet" }
  | { name: "selectStylist" }
  | { name: "selectDateTime"; stylistId: string }
  | { name: "selectMenu"; stylistId: string; desiredDateTime: string }
  | { name: "askName"; stylistId: string; desiredDateTime: string; menu: string }
  | { name: "askContact"; stylistId: string; desiredDateTime: string; menu: string; customerName: string }
  | {
      name: "confirm";
      stylistId: string;
      desiredDateTime: string;
      menu: string;
      customerName: string;
      customerContact: string;
    }
  | { name: "result"; ok: boolean; message: string; reservationId?: string };

export function ChatWindow({
  stylists,
  stores,
  initialStylistId,
}: {
  stylists: Stylist[];
  stores: Store[];
  initialStylistId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      from: "bot",
      kind: "text",
      text: "こんにちは！POMiE 予約アシスタントです。ご予約の手続きをお手伝いします。",
    },
  ]);
  const [step, setStep] = useState<Step>({ name: "greet" });
  const [pending, startTransition] = useTransition();
  const [textInput, setTextInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const storeById = useMemo(() => Object.fromEntries(stores.map((s) => [s.id, s])), [stores]);
  const stylistById = useMemo(() => Object.fromEntries(stylists.map((s) => [s.id, s])), [stylists]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 初期から美容師指定があれば、そのまま日時選択に進む
  useEffect(() => {
    if (initialStylistId && stylistById[initialStylistId]) {
      const s = stylistById[initialStylistId];
      setMessages((m) => [
        ...m,
        { from: "bot", kind: "text", text: "ご予約ありがとうございます。下のボタンから始めましょう。" },
      ]);
      pickStylist(s);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", kind: "text", text: "下のボタンを押して、ご予約を進めてください。" },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function appendBot(text: string) {
    setMessages((m) => [...m, { from: "bot", kind: "text", text }]);
  }
  function appendUser(text: string) {
    setMessages((m) => [...m, { from: "user", kind: "text", text }]);
  }
  function appendCard(s: Stylist) {
    const store = storeById[s.storeId];
    setMessages((m) => [
      ...m,
      {
        from: "bot",
        kind: "card",
        stylistName: s.name,
        storeName: store?.name ?? "",
        rating: s.rating,
        menus: s.menus.slice(0, 3).map((m) => m.name),
      },
    ]);
  }

  function pickStylist(s: Stylist) {
    appendUser(`${s.name} さんで予約したい`);
    appendCard(s);
    if (s.availableTimeSlots.length === 0) {
      appendBot("申し訳ありません、現在この美容師の予約枠がありません。別の方をお選びください。");
      setStep({ name: "selectStylist" });
      return;
    }
    appendBot("ご希望の日時をお選びください。");
    setStep({ name: "selectDateTime", stylistId: s.id });
  }

  function startBooking() {
    appendUser("予約する");
    appendBot("ご希望の美容師をお選びください。");
    setStep({ name: "selectStylist" });
  }

  function pickDateTime(slot: string) {
    if (step.name !== "selectDateTime") return;
    appendUser(formatDateTime(slot));
    appendBot("メニューをお選びください。");
    setStep({ name: "selectMenu", stylistId: step.stylistId, desiredDateTime: slot });
  }

  function pickMenu(menu: string) {
    if (step.name !== "selectMenu") return;
    appendUser(menu);
    appendBot("お名前を入力してください。");
    setStep({
      name: "askName",
      stylistId: step.stylistId,
      desiredDateTime: step.desiredDateTime,
      menu,
    });
  }

  function submitName() {
    if (step.name !== "askName") return;
    const name = textInput.trim();
    if (!name) return;
    appendUser(name);
    appendBot("ご連絡先（メールまたは電話）をお願いします。");
    setStep({
      name: "askContact",
      stylistId: step.stylistId,
      desiredDateTime: step.desiredDateTime,
      menu: step.menu,
      customerName: name,
    });
    setTextInput("");
  }

  function submitContact() {
    if (step.name !== "askContact") return;
    const contact = textInput.trim();
    if (!contact) return;
    appendUser(contact);
    setTextInput("");

    const stylist = stylistById[step.stylistId];
    appendBot(
      `内容を確認します。\n` +
        `美容師: ${stylist.name}\n` +
        `日時: ${formatDateTime(step.desiredDateTime)}\n` +
        `メニュー: ${step.menu}\n` +
        `お名前: ${step.customerName}\n` +
        `連絡先: ${contact}\n\n` +
        `この内容で予約してよろしいですか？`
    );
    setStep({
      name: "confirm",
      stylistId: step.stylistId,
      desiredDateTime: step.desiredDateTime,
      menu: step.menu,
      customerName: step.customerName,
      customerContact: contact,
    });
  }

  function confirmReservation() {
    if (step.name !== "confirm") return;
    appendUser("予約する");
    startTransition(async () => {
      const result = await createReservation({
        stylistId: step.stylistId,
        channel: "line",
        desiredDateTime: step.desiredDateTime,
        menu: step.menu,
        customerName: step.customerName,
        customerContact: step.customerContact,
      });

      if (result.ok) {
        const stylist = stylistById[step.stylistId];
        const store = storeById[stylist.storeId];
        appendBot(
          `予約が確定しました 🎉\n` +
            `予約番号: ${result.reservation.id}\n` +
            `店舗: ${store?.name ?? ""}\n` +
            `サロンボード予約 ID: ${result.reservation.salonboard.bookingId ?? "-"}\n\n` +
            `当日お会いできるのを楽しみにしております。`
        );
        setStep({
          name: "result",
          ok: true,
          message: "予約完了",
          reservationId: result.reservation.id,
        });
      } else {
        const reason = REASON_LABELS[result.reason] ?? result.reason;
        appendBot(`予約に失敗しました: ${reason}\nもう一度お試しください。`);
        setStep({ name: "result", ok: false, message: reason });
      }
    });
  }

  function reset() {
    setMessages([
      { from: "bot", kind: "text", text: "もう一度ご予約しますね。" },
    ]);
    setStep({ name: "greet" });
    setTextInput("");
  }

  return (
    <div className="mx-auto flex h-[640px] max-w-md flex-col overflow-hidden rounded-3xl bg-[#7eaccd] shadow-xl ring-2 ring-[#5a8fb6]">
      <div className="flex items-center justify-between bg-[#5a8fb6] px-4 py-3 text-white">
        <span className="text-sm font-semibold">POMiE 予約アシスタント (Mock)</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">LINE Mock</span>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#7eaccd] p-4">
        {messages.map((m, i) => (
          <BubbleView key={i} message={m} />
        ))}
        {pending && <p className="text-center text-xs text-white/80">予約中...</p>}
      </div>

      <div className="bg-white p-3">
        {step.name === "greet" && (
          <Quick label="予約する" onClick={startBooking} disabled={pending} />
        )}

        {step.name === "selectStylist" && (
          <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto">
            {stylists.map((s) => (
              <Quick
                key={s.id}
                label={`${s.name}（${storeById[s.storeId]?.name ?? ""}）`}
                onClick={() => pickStylist(s)}
                disabled={pending}
              />
            ))}
          </div>
        )}

        {step.name === "selectDateTime" && (
          <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
            {stylistById[step.stylistId]?.availableTimeSlots.map((slot) => (
              <Quick
                key={slot}
                label={formatDateTime(slot)}
                onClick={() => pickDateTime(slot)}
                disabled={pending}
              />
            ))}
          </div>
        )}

        {step.name === "selectMenu" && (
          <div className="grid grid-cols-2 gap-2">
            {stylistById[step.stylistId]?.menus.map((m) => (
              <Quick
                key={m.name}
                label={`${m.name} (${m.duration}分)`}
                onClick={() => pickMenu(m.name)}
                disabled={pending}
              />
            ))}
          </div>
        )}

        {(step.name === "askName" || step.name === "askContact") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step.name === "askName") submitName();
              else submitContact();
            }}
            className="flex gap-2"
          >
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={step.name === "askName" ? "お名前" : "メール または 電話番号"}
              className="flex-1 rounded-full border border-ink-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pomie-200"
              autoFocus
            />
            <button type="submit" className="btn-primary px-4 py-2 text-xs">
              送信
            </button>
          </form>
        )}

        {step.name === "confirm" && (
          <div className="flex gap-2">
            <Quick label="予約する" onClick={confirmReservation} disabled={pending} />
            <Quick label="やり直す" onClick={reset} disabled={pending} variant="ghost" />
          </div>
        )}

        {step.name === "result" && (
          <div className="flex flex-col gap-2">
            {step.ok && step.reservationId && (
              <a
                href={`/reservations/${step.reservationId}/complete`}
                className="btn-primary block text-center"
              >
                予約詳細を見る
              </a>
            )}
            <Quick label="もう一度予約する" onClick={reset} variant="ghost" />
          </div>
        )}
      </div>
    </div>
  );
}

function BubbleView({ message }: { message: Message }) {
  if (message.from === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#7be481] px-4 py-2 text-sm text-ink-900 shadow-sm whitespace-pre-line">
          {message.text}
        </div>
      </div>
    );
  }
  if (message.kind === "text") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm text-ink-900 shadow-sm whitespace-pre-line">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white p-3 shadow-sm">
        <p className="text-sm font-bold text-ink-900">{message.stylistName}</p>
        <p className="text-xs text-ink-500">
          {message.storeName} ・ ★ {message.rating.toFixed(1)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {message.menus.map((m) => (
            <span key={m} className="rounded-full bg-pomie-100 px-2 py-0.5 text-[10px] text-pomie-700">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Quick({
  label,
  onClick,
  disabled,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border text-xs font-semibold transition px-3 py-2 ${
        variant === "primary"
          ? "border-pomie-500 bg-pomie-500 text-white hover:bg-pomie-600 disabled:opacity-60"
          : "border-ink-100 bg-white text-ink-700 hover:bg-pomie-100 disabled:opacity-60"
      }`}
    >
      {label}
    </button>
  );
}

const REASON_LABELS: Record<string, string> = {
  stylist_not_available: "選択された美容師は現在予約を受け付けていません。",
  store_not_found: "店舗情報が取得できませんでした。",
  stylist_slot_unavailable: "選択された日時は予約できません。",
  salonboard_unavailable: "サロンボード側で席が満席のため予約できません。別の日時をお選びください。",
  salonboard_forced_failure: "サロンボード連携に失敗しました（強制失敗）。",
  unknown_shop: "店舗情報がサロンボードに登録されていません。",
};
