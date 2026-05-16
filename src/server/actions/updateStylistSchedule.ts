"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";

export type UpdateScheduleResult =
  | { ok: true; count: number }
  | { ok: false; reason: string };

/**
 * 美容師の予約可能枠 (available_time_slots) のみを保存する軽量 Server Action。
 * /stylist/[id]/schedule から呼ばれる。
 */
export async function updateStylistSchedule(
  stylistId: string,
  slots: string[]
): Promise<UpdateScheduleResult> {
  if (!stylistId) return { ok: false, reason: "missing_id" };
  if (!Array.isArray(slots)) return { ok: false, reason: "invalid_slots" };

  const sb = getSupabase();
  const { error } = await sb
    .from("stylists")
    .update({
      available_time_slots: slots,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stylistId);

  if (error) return { ok: false, reason: error.message };

  revalidatePath(`/stylist/${stylistId}`);
  revalidatePath(`/stylist/${stylistId}/schedule`);
  revalidatePath(`/stylists/${stylistId}`);
  revalidatePath("/admin/stylists");
  return { ok: true, count: slots.length };
}
