"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";

export type StylistEdit = {
  id: string;
  contractStatus?: "active" | "inactive";
  featuredFlag?: boolean;
};

export type ApplyStylistEditsResult =
  | { ok: true; updatedCount: number; failedIds: string[] }
  | { ok: false; reason: string };

/**
 * 一括編集モード用: 行ごとに異なる変更内容をまとめて適用する。
 * 各行は並列で UPDATE（Supabase はトランザクション API を JS SDK で持たないため部分成功あり）。
 */
export async function applyStylistEdits(edits: StylistEdit[]): Promise<ApplyStylistEditsResult> {
  if (!edits || edits.length === 0) return { ok: false, reason: "no_edits" };

  const sb = getSupabase();
  const now = new Date().toISOString();

  const results = await Promise.all(
    edits.map(async (edit) => {
      const patch: Record<string, unknown> = { updated_at: now };
      if (edit.contractStatus !== undefined) patch.contract_status = edit.contractStatus;
      if (edit.featuredFlag !== undefined) patch.featured_flag = edit.featuredFlag;
      if (Object.keys(patch).length <= 1) {
        return { id: edit.id, ok: true };
      }
      const { error } = await sb.from("stylists").update(patch).eq("id", edit.id);
      return { id: edit.id, ok: !error, error: error?.message };
    })
  );

  const failedIds = results.filter((r) => !r.ok).map((r) => r.id);
  const updatedCount = results.length - failedIds.length;

  revalidatePath("/admin/stylists");
  revalidatePath("/stylists");
  revalidatePath("/");

  return { ok: true, updatedCount, failedIds };
}
