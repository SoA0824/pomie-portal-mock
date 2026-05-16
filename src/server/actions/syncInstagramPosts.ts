"use server";

import { revalidatePath } from "next/cache";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { replaceInstagramPosts } from "@/lib/data/snsPosts";
import { getInstagramFetcher } from "@/lib/integrations/instagram";
import { getSupabase } from "@/lib/supabase/client";

export type SyncResult =
  | { ok: true; count: number; via: "apify" | "mock" }
  | { ok: false; reason: string };

export async function syncInstagramPosts(stylistId: string): Promise<SyncResult> {
  const stylist = await getStylistByIdIncludingInactive(stylistId);
  if (!stylist) return { ok: false, reason: "stylist_not_found" };
  if (!stylist.instagramHandle) return { ok: false, reason: "no_instagram_handle" };

  const fetcher = getInstagramFetcher();
  const via = process.env.APIFY_API_TOKEN && process.env.INSTAGRAM_FETCHER !== "mock"
    ? "apify"
    : "mock";

  try {
    const posts = await fetcher.fetchLatestPosts({
      handle: stylist.instagramHandle,
      limit: 8,
    });
    const count = await replaceInstagramPosts(stylistId, posts);

    // 同期時刻を stylists テーブルに記録
    const sb = getSupabase();
    await sb
      .from("stylists")
      .update({ instagram_synced_at: new Date().toISOString() })
      .eq("id", stylistId);

    revalidatePath(`/stylists/${stylistId}`);
    revalidatePath("/admin/stylists");

    return { ok: true, count, via };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return { ok: false, reason: message };
  }
}
