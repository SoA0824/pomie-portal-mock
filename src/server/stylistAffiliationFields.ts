import { getStoreById } from "@/lib/data/stores";
import type { CreateStylistInput } from "@/lib/types";

type AffiliationFields = {
  affiliation: "pomie" | "external";
  store_id: string | null;
  area: string | null;
  external_salon_name: string | null;
  external_booking_enabled: boolean;
  booking_mode: "pomie" | "external";
};

/**
 * 所属（POMiE / 外部）に応じて、保存する列を決める。
 * - POMiE の美容師: 店舗が必須。エリアは店舗から決まる
 * - 外部美容師: サロン名が必須。POMiE の予約システムは使えないので予約方式は external 固定
 */
export function resolveAffiliationFields(
  input: Pick<CreateStylistInput, "affiliation" | "storeId" | "externalSalonName" | "externalBookingEnabled" | "bookingMode">
): { ok: true; fields: AffiliationFields } | { ok: false; reason: string; field: string } {
  const affiliation = input.affiliation ?? "pomie";

  if (affiliation === "external") {
    const salon = input.externalSalonName?.trim();
    if (!salon) return { ok: false, reason: "missing_salon_name", field: "externalSalonName" };
    return {
      ok: true,
      fields: {
        affiliation,
        store_id: null,
        area: null,
        external_salon_name: salon,
        external_booking_enabled: Boolean(input.externalBookingEnabled),
        booking_mode: "external",
      },
    };
  }

  if (!input.storeId?.trim()) return { ok: false, reason: "missing_store", field: "storeId" };
  const store = getStoreById(input.storeId);
  if (!store) return { ok: false, reason: "invalid_store", field: "storeId" };
  return {
    ok: true,
    fields: {
      affiliation: "pomie",
      store_id: store.id,
      area: store.area,
      external_salon_name: null,
      external_booking_enabled: false,
      booking_mode: input.bookingMode ?? "external",
    },
  };
}
