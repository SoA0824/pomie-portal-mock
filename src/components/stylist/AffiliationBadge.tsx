import type { Stylist } from "@/lib/types";
import { affiliationOf } from "@/lib/stylistAffiliation";

/**
 * 美容師の所属表示。
 * - POMiE の美容師: 「POMiE 表参道店」のバッジ
 * - 外部美容師: 所属サロン名のみ（バッジなし）
 */
export function AffiliationBadge({
  stylist,
  size = "sm",
}: {
  stylist: Pick<Stylist, "affiliation" | "storeId" | "externalSalonName">;
  size?: "sm" | "md";
}) {
  const a = affiliationOf(stylist);
  if (a.isPomie) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-ink-900 font-semibold tracking-wide text-white ${
          size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
        }`}
      >
        {a.label}
      </span>
    );
  }
  if (!a.label) return null;
  return <span className={size === "md" ? "text-sm text-ink-500" : "text-xs text-ink-500"}>{a.label}</span>;
}
