"use server";

import { getStylistById } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { appendReservation, generateReservationId } from "@/lib/data/reservations";
import { getSalonboardClient } from "@/lib/integrations/salonboard";
import type {
  CreateReservationInput,
  CreateReservationResult,
  Reservation,
  SalonboardSyncStatus,
} from "@/lib/types";

export async function createReservation(
  input: CreateReservationInput
): Promise<CreateReservationResult> {
  const stylist = await getStylistById(input.stylistId);
  if (!stylist) {
    return { ok: false, reason: "stylist_not_available" };
  }
  const store = getStoreById(stylist.storeId);
  if (!store) {
    return { ok: false, reason: "store_not_found" };
  }

  if (!stylist.availableTimeSlots.includes(input.desiredDateTime)) {
    return { ok: false, reason: "stylist_slot_unavailable" };
  }

  // ===== メニュー検証 + 施術時間合計 =====
  if (!input.menus || input.menus.length === 0) {
    return { ok: false, reason: "no_menus_selected" };
  }
  let totalDuration = 0;
  for (const menuName of input.menus) {
    const m = stylist.menus.find((sm) => sm.name === menuName);
    if (!m) {
      return { ok: false, reason: `unknown_menu:${menuName}` };
    }
    totalDuration += m.duration;
  }
  const menusLabel = input.menus.join(" + ");

  const sb = getSalonboardClient();

  const avail = await sb.checkAvailability({
    shopId: store.salonboardShopId,
    dateTime: input.desiredDateTime,
  });
  if (!avail.available) {
    return { ok: false, reason: "salonboard_unavailable" };
  }

  const booking = await sb.createBooking({
    shopId: store.salonboardShopId,
    dateTime: input.desiredDateTime,
    stylistName: stylist.name,
    customerName: input.customerName,
    customerContact: input.customerContact,
    menu: menusLabel,
  });

  const now = new Date().toISOString();

  if (!booking.ok) {
    const failed: Reservation = {
      id: generateReservationId(),
      customerName: input.customerName,
      customerContact: input.customerContact,
      stylistId: stylist.id,
      storeId: store.id,
      menus: input.menus,
      durationMinutes: totalDuration,
      desiredDateTime: input.desiredDateTime,
      channel: input.channel,
      status: "pending",
      salonboard: {
        status: "failed" satisfies SalonboardSyncStatus,
        errorMessage: booking.reason,
      },
      createdAt: now,
      updatedAt: now,
    };
    await appendReservation(failed);
    return { ok: false, reason: booking.reason, reservation: failed };
  }

  const reservation: Reservation = {
    id: generateReservationId(),
    customerName: input.customerName,
    customerContact: input.customerContact,
    stylistId: stylist.id,
    storeId: store.id,
    menus: input.menus,
    durationMinutes: totalDuration,
    desiredDateTime: input.desiredDateTime,
    channel: input.channel,
    status: "confirmed",
    salonboard: {
      status: "reserved" satisfies SalonboardSyncStatus,
      bookingId: booking.bookingId,
      syncedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  await appendReservation(reservation);
  return { ok: true, reservation };
}
