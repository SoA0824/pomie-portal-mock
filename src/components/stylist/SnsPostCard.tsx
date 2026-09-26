"use client";

import { useState } from "react";

/**
 * SNS 投稿 1 件分のカード。
 * 画像が読み込めなかった場合はカードごと非表示にし、空白のタイルを見せない。
 */
export function SnsPostCard({
  imageSrc,
  caption,
  platformLabel,
  dateLabel,
}: {
  imageSrc: string;
  caption: string;
  platformLabel: string;
  dateLabel: string;
}) {
  const [broken, setBroken] = useState(false);
  if (broken || !imageSrc) return null;

  return (
    <article className="card overflow-hidden">
      <div className="aspect-square overflow-hidden bg-ink-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={caption}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span className="rounded-full bg-pomie-100 px-2 py-0.5 text-pomie-700">
            {platformLabel}
          </span>
          <span>{dateLabel}</span>
        </div>
        <p className="mt-2 line-clamp-3 text-xs text-ink-700">{caption}</p>
      </div>
    </article>
  );
}
