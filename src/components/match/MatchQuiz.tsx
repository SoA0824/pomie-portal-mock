"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Stylist, Store } from "@/lib/types";
import { StylistAvatar } from "@/components/common/StylistAvatar";
import { formatPriceRange } from "@/lib/format";
import {
  AREA_OPTIONS,
  BUDGET_OPTIONS,
  CONCERN_OPTIONS,
  WISH_OPTIONS,
  matchStylists,
  type Selections,
} from "@/lib/matching";

type Step = "intro" | "wishes" | "concerns" | "area" | "budget" | "results";

const STEPS: Step[] = ["wishes", "concerns", "area", "budget"];

export function MatchQuiz({
  stylists,
  storesById,
}: {
  stylists: Stylist[];
  storesById: Record<string, Store>;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [selections, setSelections] = useState<Selections>({
    wishes: [],
    concerns: [],
    area: null,
    budgetMax: null,
  });

  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);
  const totalSteps = STEPS.length;

  const results = useMemo(() => {
    if (step !== "results") return [];
    return matchStylists(stylists, selections);
  }, [step, stylists, selections]);

  const toggleArrItem = (key: "wishes" | "concerns", v: string) => {
    setSelections((s) => ({
      ...s,
      [key]: s[key].includes(v)
        ? s[key].filter((x) => x !== v)
        : [...s[key], v],
    }));
  };

  const reset = () => {
    setSelections({ wishes: [], concerns: [], area: null, budgetMax: null });
    setStep("intro");
  };

  const goPrev = () => {
    const order: Step[] = ["intro", ...STEPS, "results"];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
  };
  const goNext = () => {
    const order: Step[] = ["intro", ...STEPS, "results"];
    const i = order.indexOf(step);
    if (i < order.length - 1) setStep(order[i + 1]);
  };

  // ===== INTRO =====
  if (step === "intro") {
    return (
      <div className="card mx-auto max-w-2xl p-8 text-center">
        <span className="chip">美容師マッチング診断</span>
        <h1 className="mt-4 text-2xl font-bold leading-snug md:text-3xl">
          4 つの質問で、あなたに<br />
          ぴったりの美容師を診断します。
        </h1>
        <p className="mt-3 text-sm text-ink-700">
          髪のお悩み・希望スタイル・店舗エリア・予算をお選びいただくと、
          ポミエの契約美容師の中から相性のいい 3 人を提案します。
        </p>
        <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-xs text-ink-500">
          <li>✓ 所要時間 約 30 秒</li>
          <li>✓ 登録不要・無料</li>
          <li>✓ 結果から直接予約に進めます</li>
        </ul>
        <button
          type="button"
          onClick={() => setStep("wishes")}
          className="btn-primary mt-6"
        >
          診断スタート →
        </button>
      </div>
    );
  }

  // ===== RESULTS =====
  if (step === "results") {
    const top = results.slice(0, 3);
    return (
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <span className="chip">診断結果</span>
          <h1 className="mt-3 text-2xl font-bold md:text-3xl">
            あなたにぴったりの美容師 {top.length} 名
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            選んだ条件と相性のいい美容師を、おすすめ順に表示しています。
          </p>
        </header>

        {top.length === 0 ? (
          <div className="card mt-6 p-8 text-center text-sm text-ink-700">
            条件に合う美容師が見つかりませんでした。<br />
            選択を見直すか、予算を上げてお試しください。
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={reset} className="btn-secondary">
                最初からやり直す
              </button>
              <Link href="/stylists" className="btn-primary">
                美容師一覧を見る
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ol className="mt-6 space-y-3">
              {top.map((r, i) => {
                const store = storesById[r.stylist.storeId];
                return (
                  <li key={r.stylist.id}>
                    <ResultCard
                      rank={i + 1}
                      stylist={r.stylist}
                      storeName={store?.name}
                      matchedStrengths={r.matchedStrengths}
                      reasons={r.reasons}
                    />
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={reset} className="btn-secondary">
                もう一度診断する
              </button>
              <Link href="/stylists" className="btn-primary">
                すべての美容師を見る
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  // ===== QUESTION STEPS =====
  return (
    <div className="card mx-auto max-w-2xl p-6">
      <header>
        <p className="text-xs font-semibold text-pomie-700">
          Step {stepIndex + 1} / {totalSteps}
        </p>
        <div className="mt-1.5 flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                i <= stepIndex ? "bg-pomie-500" : "bg-ink-100"
              }`}
            />
          ))}
        </div>
      </header>

      {step === "wishes" && (
        <Question
          title="主な希望を選んでください"
          subtitle="複数選択できます"
        >
          <ChipGroup
            options={WISH_OPTIONS.map((o) => o.key)}
            selected={selections.wishes}
            onToggle={(v) => toggleArrItem("wishes", v)}
          />
        </Question>
      )}

      {step === "concerns" && (
        <Question
          title="お悩み・希望のテイストは？"
          subtitle="複数選択できます"
        >
          <ChipGroup
            options={CONCERN_OPTIONS.map((o) => o.key)}
            selected={selections.concerns}
            onToggle={(v) => toggleArrItem("concerns", v)}
          />
        </Question>
      )}

      {step === "area" && (
        <Question title="希望エリアは？" subtitle="任意・どちらでも可">
          <RadioGroup
            options={[
              { label: "こだわらない", value: null },
              ...AREA_OPTIONS.map((a) => ({ label: a, value: a })),
            ]}
            selected={selections.area ?? null}
            onChange={(v) => setSelections((s) => ({ ...s, area: v }))}
          />
        </Question>
      )}

      {step === "budget" && (
        <Question title="予算の上限は？" subtitle="任意">
          <RadioGroup
            options={[
              { label: "こだわらない", value: null },
              ...BUDGET_OPTIONS.map((b) => ({
                label: `〜¥${b.toLocaleString()}`,
                value: b,
              })),
            ]}
            selected={selections.budgetMax ?? null}
            onChange={(v) => setSelections((s) => ({ ...s, budgetMax: v }))}
          />
        </Question>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          className="text-xs text-ink-500 hover:text-ink-700"
        >
          ← 戻る
        </button>
        <button
          type="button"
          onClick={() => {
            if (step === "budget") setStep("results");
            else goNext();
          }}
          disabled={
            (step === "wishes" && selections.wishes.length === 0) ||
            (step === "concerns" && selections.concerns.length === 0)
          }
          className="btn-primary disabled:opacity-40"
        >
          {step === "budget" ? "診断する →" : "次へ →"}
        </button>
      </div>
    </div>
  );
}

function Question({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h2 className="text-lg font-bold leading-snug">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              active
                ? "bg-pomie-500 text-white shadow-sm"
                : "bg-white text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
            }`}
          >
            {active && <span className="mr-1">✓</span>}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function RadioGroup<T extends string | number | null>({
  options,
  selected,
  onChange,
}: {
  options: Array<{ label: string; value: T }>;
  selected: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o, i) => {
        const active = o.value === selected;
        return (
          <button
            key={`${String(o.value)}-${i}`}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              active
                ? "bg-pomie-500 text-white shadow-sm"
                : "bg-white text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ResultCard({
  rank,
  stylist,
  storeName,
  matchedStrengths,
  reasons,
}: {
  rank: number;
  stylist: Stylist;
  storeName?: string;
  matchedStrengths: string[];
  reasons: string[];
}) {
  return (
    <article className="card overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-4 md:p-5">
        <div className="relative flex-shrink-0">
          <StylistAvatar
            src={stylist.avatar}
            name={stylist.name}
            rounded
            className="h-20 w-20"
          />
          <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-pomie-500 text-xs font-bold text-white shadow-md">
            #{rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-lg font-bold">{stylist.name}</h3>
            <span className="text-xs text-ink-500">{stylist.nameKana}</span>
            <span className="text-xs text-pomie-600">★ {stylist.rating.toFixed(1)}</span>
          </div>
          <p className="text-xs text-ink-500">
            {storeName ?? "-"} ・ {formatPriceRange(stylist.priceRange.min, stylist.priceRange.max)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <span
                key={r}
                className="inline-flex rounded-full bg-pomie-100 px-2.5 py-0.5 text-xs text-pomie-700"
              >
                {r}
              </span>
            ))}
          </div>
          {matchedStrengths.length > 0 && (
            <p className="mt-2 text-xs text-ink-700">
              <span className="font-semibold">強み:</span>{" "}
              {matchedStrengths.join(" / ")}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-100/70 px-4 py-3 md:px-5">
        <Link
          href={`/reservations/new?stylistId=${stylist.id}`}
          className="rounded-full bg-pomie-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-pomie-600"
        >
          予約する
        </Link>
        <Link
          href={`/stylists/${stylist.id}`}
          className="rounded-full border border-ink-100 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-pomie-100"
        >
          詳細を見る
        </Link>
        <Link
          href={`/line-bot?stylistId=${stylist.id}`}
          className="ml-auto text-xs text-pomie-600 hover:underline"
        >
          LINE で予約 ↗
        </Link>
      </div>
    </article>
  );
}
