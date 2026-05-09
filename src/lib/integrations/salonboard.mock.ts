import { getAllStores } from "../data/stores";
import { getSupabase } from "@/lib/supabase/client";
import type { SalonboardClient } from "../types";

function getCapacityByShopId(shopId: string): number {
  const store = getAllStores().find((s) => s.salonboardShopId === shopId);
  return store?.salonboardCapacityPerSlot ?? 0;
}

function generateBookingId(): string {
  return `SB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function shouldForceFail(customerContact: string): boolean {
  // QA 用: 連絡先に "salonboard-fail" を含む場合は強制失敗（モック検証用フック）
  return /salonboard-fail/i.test(customerContact);
}

export function createSalonboardMock(): SalonboardClient {
  return {
    async checkAvailability({ shopId, dateTime }) {
      const capacity = getCapacityByShopId(shopId);
      const sb = getSupabase();
      const { count, error } = await sb
        .from("salonboard_bookings")
        .select("booking_id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("date_time", dateTime);
      if (error) throw new Error(`Salonboard checkAvailability failed: ${error.message}`);
      const used = count ?? 0;
      const remaining = Math.max(0, capacity - used);
      return { available: remaining > 0, remaining, capacity };
    },

    async createBooking(input) {
      if (shouldForceFail(input.customerContact)) {
        return { ok: false, reason: "salonboard_forced_failure" };
      }
      const capacity = getCapacityByShopId(input.shopId);
      if (capacity <= 0) {
        return { ok: false, reason: "unknown_shop" };
      }
      const sb = getSupabase();

      // 容量チェック
      const { count: usedCount, error: countError } = await sb
        .from("salonboard_bookings")
        .select("booking_id", { count: "exact", head: true })
        .eq("shop_id", input.shopId)
        .eq("date_time", input.dateTime);
      if (countError) {
        return { ok: false, reason: `count_error: ${countError.message}` };
      }
      if ((usedCount ?? 0) >= capacity) {
        return { ok: false, reason: "salonboard_unavailable" };
      }

      const bookingId = generateBookingId();
      const { error: insertError } = await sb.from("salonboard_bookings").insert({
        booking_id: bookingId,
        shop_id: input.shopId,
        date_time: input.dateTime,
        stylist_name: input.stylistName,
        customer_name: input.customerName,
        customer_contact: input.customerContact,
        menu: input.menu,
      });
      if (insertError) {
        return { ok: false, reason: `insert_error: ${insertError.message}` };
      }
      return { ok: true, bookingId };
    },

    async cancelBooking({ bookingId }) {
      const sb = getSupabase();
      const { error, count } = await sb
        .from("salonboard_bookings")
        .delete({ count: "exact" })
        .eq("booking_id", bookingId);
      if (error) return { ok: false };
      return { ok: (count ?? 0) > 0 };
    },

    async listMockBookings() {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("salonboard_bookings")
        .select("booking_id, shop_id, date_time, stylist_name, customer_name")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Salonboard listMockBookings failed: ${error.message}`);
      return (data ?? []).map((b) => ({
        bookingId: b.booking_id,
        shopId: b.shop_id,
        dateTime: b.date_time,
        stylistName: b.stylist_name,
        customerName: b.customer_name,
      }));
    },
  };
}
