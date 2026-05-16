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
    menu: input.menu,
  });

  const now = new Date().toISOString();

  if (!booking.ok) {
    const failed: Reservation = {
      id: generateReservationId(),
      customerName: input.customerName,
      customerContact: input.customerContact,
      stylistId: stylist.id,
      storeId: store.id,
      menu: input.menu,
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
    menu: input.menu,
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
