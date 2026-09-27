"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** 計測しないページ（管理画面・美容師の管理画面） */
const EXCLUDED_PATH = /^\/(admin|stylist)(\/|$)/;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

/**
 * Google アナリティクス 4。
 *
 * - 管理画面（/admin, /stylist）は計測しない（GA の公式な無効化フラグを使用）
 * - ページ遷移は GA4 の「拡張計測機能（ブラウザの履歴イベント）」で自動計測される
 * - data-ga-event 属性を付けたリンク・ボタンのクリックをイベントとして送る
 *   例: <a data-ga-event="booking_click" data-ga-stylist_id="st-01">
 *       → gtag("event", "booking_click", { stylist_id: "st-01" })
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const disableKey = `ga-disable-${measurementId}` as const;

  // 画面遷移のたびに、管理画面かどうかで計測の有効/無効を切り替える
  useEffect(() => {
    window[disableKey] = EXCLUDED_PATH.test(pathname ?? "");
  }, [pathname, disableKey]);

  // data-ga-event を持つ要素のクリックをイベント送信
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-ga-event]");
      if (!el || !window.gtag) return;
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(el.dataset)) {
        // dataset では data-ga-stylist_id が gaStylist_id になる
        if (key.startsWith("ga") && key !== "gaEvent" && value !== undefined) {
          const name = key.slice(2);
          params[name.charAt(0).toLowerCase() + name.slice(1)] = value;
        }
      }
      window.gtag("event", el.dataset.gaEvent as string, params);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window['${disableKey}'] = ${EXCLUDED_PATH}.test(location.pathname);
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
