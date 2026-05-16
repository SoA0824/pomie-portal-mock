"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";

export type BulkUpdateInput = {
  ids: string[];
  changes: {
    contractStatus?: "active" | "inactive";
    featuredFlag?: boolean;
  };
};

export type BulkUpdateResult =
  | { ok: true; updatedCount: number }
  | { ok: false; reason: string };

export async function bulkUpdateStylists(input: BulkUpdateInput): Promise<BulkUpdateResult> {
  if (!input.ids || input.ids.length === 0) {
    return { ok: false, reason: "no_ids" };
  }
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.changes.contractStatus !== undefined) {
    patch.contract_status = input.changes.contractStatus;
  }
  if (input.changes.featuredFlag !== undefined) {
    patch.featured_flag = input.changes.featuredFlag;
  }
  if (Object.keys(patch).length <= 1) {
    return { ok: false, reason: "no_changes" };
  }

  const sb = getSupabase();
  const { error, data } = await sb
    .from("stylists")
    .update(patch)
    .in("id", input.ids)
    .select("id");

  if (error) return { ok: false, reason: error.message };

  revalidatePath("/admin/stylists");
  revalidatePath("/stylists");
  revalidatePath("/");

  return { ok: true, updatedCount: data?.length ?? 0 };
}
