import { getSupabase, type ReservationRow } from "@/lib/supabase/client";
import type { Reservation } from "../types";

function rowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    stylistId: row.stylist_id,
    storeId: row.store_id,
    menu: row.menu,
    desiredDateTime: row.desired_date_time,
    channel: row.channel,
    status: row.status,
    salonboard: {
      status: row.salonboard_status,
      bookingId: row.salonboard_booking_id ?? undefined,
      syncedAt: row.salonboard_synced_at ?? undefined,
      errorMessage: row.salonboard_error_message ?? undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function reservationToRow(r: Reservation): ReservationRow {
  return {
    id: r.id,
    customer_name: r.customerName,
    customer_contact: r.customerContact,
    stylist_id: r.stylistId,
    store_id: r.storeId,
    menu: r.menu,
    desired_date_time: r.desiredDateTime,
    channel: r.channel,
    status: r.status,
    salonboard_status: r.salonboard.status,
    salonboard_booking_id: r.salonboard.bookingId ?? null,
    salonboard_synced_at: r.salonboard.syncedAt ?? null,
    salonboard_error_message: r.salonboard.errorMessage ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function listReservations(): Promise<Reservation[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to list reservations: ${error.message}`);
  return (data ?? []).map(rowToReservation);
}

export async function getReservationById(id: string): Promise<Reservation | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb.from("reservations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to fetch reservation: ${error.message}`);
  return data ? rowToReservation(data) : undefined;
}

export async function appendReservation(reservation: Reservation): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("reservations").insert(reservationToRow(reservation));
  if (error) throw new Error(`Failed to insert reservation: ${error.message}`);
}

export function generateReservationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `r-${ts}${rand}`.toUpperCase();
}
