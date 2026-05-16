"use client";

import { useState } from "react";

const BG_PALETTE = [
  "bg-pomie-400",
  "bg-pomie-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-rose-400",
  "bg-amber-500",
  "bg-purple-500",
  "bg-teal-500",
];

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickBg(name: string): string {
  if (!name) return BG_PALETTE[0];
  return BG_PALETTE[hashCode(name) % BG_PALETTE.length];
}

function pickInitial(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  // 日本語名なら姓の最初の文字（漢字 / カナ）、英語名なら最初の文字を返す
  return trimmed[0];
}

/**
 * 美容師アバター表示用コンポーネント。
 * - src があり読み込み成功 → 画像表示
 * - src なし、または onError 発火 → イニシャル＋背景色のフォールバック表示
 *
 * 外部画像サービス（unavatar.io / picsum.photos など）のレート制限・障害時にも壊れない。
 */
export function StylistAvatar({
  src,
  name,
  className = "",
  rounded = false,
}: {
  src?: string;
  name: string;
  className?: string;
  rounded?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(src) && !errored;
  const radius = rounded ? "rounded-full" : "";

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setErrored(true)}
        className={`${className} ${radius} object-cover`}
        loading="lazy"
      />
    );
  }

  const bg = pickBg(name);
  const initial = pickInitial(name);

  return (
    <div
      className={`${className} ${radius} ${bg} flex items-center justify-center font-bold text-white`}
      aria-label={name}
      role="img"
    >
      <span className="text-[2.5em] leading-none">{initial}</span>
    </div>
  );
}
