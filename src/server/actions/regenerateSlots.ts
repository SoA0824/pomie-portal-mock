"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { generateDummyAvailableSlots } from "@/lib/generateDummySlots";

export type RegenerateResult =
  | { ok: true; affected: number }
  | { ok: false; reason: string };

/**
 * 1 名の美容師のダミー予約枠を再生成する。
 */
export async function regenerateSlots(stylistId: string): Promise<RegenerateResult> {
  const sb = getSupabase();
  const slots = generateDummyAvailableSlots(stylistId, 8);
  const { error } = await sb
    .from("stylists")
    .update({
      available_time_slots: slots,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stylistId);

  if (error) return { ok: false, reason: error.message };

  revalidatePath("/admin/stylists");
  revalidatePath(`/stylists/${stylistId}`);
  return { ok: true, affected: 1 };
}

/**
 * 全美容師（active / inactive 問わず）のダミー予約枠を一括で再生成する。
 */
export async function regenerateAllSlots(): Promise<RegenerateResult> {
  const sb = getSupabase();
  const { data: list, error: listError } = await sb
    .from("stylists")
    .select("id");
  if (listError) return { ok: false, reason: listError.message };
  if (!list || list.length === 0) return { ok: true, affected: 0 };

  const now = new Date().toISOString();
  const results = await Promise.all(
    list.map(async (row) => {
      const slots = generateDummyAvailableSlots(row.id, 8);
      const { error } = await sb
        .from("stylists")
        .update({ available_time_slots: slots, updated_at: now })
        .eq("id", row.id);
      return !error;
    })
  );

  const affected = results.filter(Boolean).length;
  revalidatePath("/admin/stylists");
  revalidatePath("/stylists");
  revalidatePath("/");
  return { ok: true, affected };
}
