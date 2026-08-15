import Link from "next/link";
import type { Stylist } from "@/lib/types";

/**
 * 美容師ごとの予約導線。
 *
 * - bookingMode === "pomie"    … POMiE システムの Web / LINE 予約へ
 * - bookingMode === "external" … 美容師が設定した外部リンク（Web フォーム / Instagram DM 等）
 *
 * 最終版の予約導線が完成するまでは、既定を external にして
 * 美容師ごとの受付先へ誘導する運用。
 */
export function BookingActions({
  stylist,
  size = "large",
}: {
  stylist: Stylist;
  /** large: 詳細ページ用 / small: カード内用 */
  size?: "large" | "small";
}) {
  const isSmall = size === "small";
  const primaryClass = isSmall
    ? "rounded-full bg-pomie-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-pomie-600"
    : "btn-primary";
  const secondaryClass = isSmall
    ? "rounded-full border border-ink-100 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-pomie-100"
    : "btn-secondary";

  if (stylist.bookingMode === "pomie") {
    return (
      <div className={isSmall ? "flex flex-wrap gap-2" : "flex flex-col gap-3 sm:flex-row"}>
        <Link href={`/reservations/new?stylistId=${stylist.id}`} className={primaryClass}>
          Web で予約
        </Link>
        <Link href={`/line-bot?stylistId=${stylist.id}`} className={secondaryClass}>
          LINE で予約
        </Link>
      </div>
    );
  }

  // 外部受付：リンク未設定なら何も出さない（誤って予約できない導線を見せない）
  const links = stylist.bookingLinks ?? [];
  if (links.length === 0) return null;

  return (
    <div className={isSmall ? "flex flex-wrap gap-2" : "flex flex-col gap-3 sm:flex-row"}>
      {links.map((link, i) => (
        <a
          key={`${link.url}-${i}`}
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          className={i === 0 ? primaryClass : secondaryClass}
        >
          {link.label} ↗
        </a>
      ))}
    </div>
  );
}
