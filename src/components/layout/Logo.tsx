"use client";

import { useState } from "react";

// ロゴ画像の候補（順に試す）。SVG を最優先、無ければ PNG、最後はテキストロゴ。
const CANDIDATES = ["/logo/pomie-logo.svg", "/logo/pomie-logo.png"];

/**
 * POMiE ロゴ。
 * - public/logo/pomie-logo.svg (or .png) があればそれを表示
 * - 無ければ「P バッジ + POMiE Portal」のテキストロゴにフォールバック
 */
export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  const [idx, setIdx] = useState(0);

  if (idx >= CANDIDATES.length) {
    return (
      <span className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pomie-500 text-sm font-bold text-white">
          P
        </span>
        <span className="text-base font-bold tracking-tight text-ink-900">
          POMiE Portal
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CANDIDATES[idx]}
      alt="POMiE Portal"
      onError={() => setIdx((i) => i + 1)}
      className={className}
    />
  );
}
