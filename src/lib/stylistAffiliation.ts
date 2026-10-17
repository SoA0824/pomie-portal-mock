import type { Stylist } from "./types";
import { getStoreById } from "./data/stores";

/**
 * 美容師の所属の表示用情報。
 * - POMiE の美容師: 「POMiE 表参道店」のバッジ
 * - 外部美容師: 所属サロン名のみ（バッジなし）
 */
export function affiliationOf(stylist: Pick<Stylist, "affiliation" | "storeId" | "externalSalonName">) {
  if (stylist.affiliation === "external") {
    return {
      isPomie: false as const,
      label: stylist.externalSalonName ?? "",
      store: undefined,
    };
  }
  const store = getStoreById(stylist.storeId);
  return {
    isPomie: true as const,
    /** 例: POMiE 表参道店 */
    label: store ? `POMiE ${store.area}店` : "POMiE",
    store,
  };
}

/** 予約ボタンを表示してよいか（外部美容師はオプションを付けた場合のみ） */
export function canShowBooking(stylist: Pick<Stylist, "affiliation" | "externalBookingEnabled">): boolean {
  return stylist.affiliation !== "external" || stylist.externalBookingEnabled;
}
