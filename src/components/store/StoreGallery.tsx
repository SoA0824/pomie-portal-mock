"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 店舗写真のギャラリー。サムネイルをクリックすると拡大表示（前後送り・Esc で閉じる）。
 */
export function StoreGallery({ images, storeName }: { images: string[]; storeName: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setIndex((i) => (i === null ? null : (i + delta + images.length) % images.length)),
    [images.length]
  );

  // 拡大表示中: キー操作と背面のスクロール固定
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, close, step]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {images.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${storeName}の写真 ${i + 1} を拡大表示`}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-ink-100 ring-1 ring-ink-100 focus:outline-none focus:ring-2 focus:ring-pomie-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${storeName}の店内 ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {index !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${storeName}の写真 ${index + 1} / ${images.length}`}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index]}
            alt={`${storeName}の店内 ${index + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={close}
            aria-label="閉じる"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white hover:bg-white/30"
          >
            ✕
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="前の写真"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30 md:left-6"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="次の写真"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30 md:right-6"
              >
                ›
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/90">
                {index + 1} / {images.length}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
