"use server";

import { revalidatePath } from "next/cache";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { replaceInstagramPosts } from "@/lib/data/snsPosts";
import { getInstagramFetcher } from "@/lib/integrations/instagram";
import {
  mirrorInstagramImage,
  cleanupUnusedInstagramImages,
} from "@/lib/integrations/mirrorInstagramImage";
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

    // Instagram CDN の URL は有効期限つきトークンを含み、数時間〜数日で 403 になる。
    // そのまま保存すると画像が後から表示されなくなるため、取得時に自前の
    // Supabase Storage へ複製し、期限切れしない URL に差し替える。
    // 複製に失敗した投稿は元の URL のまま（画像プロキシ経由で当面は表示できる）。
    const mirrored = await Promise.all(
      posts.map(async (p) => {
        const url = await mirrorInstagramImage(stylistId, p.externalId, p.imageUrl);
        return { ...p, imageUrl: url ?? p.imageUrl };
      })
    );

    const count = await replaceInstagramPosts(stylistId, mirrored);

    // 最新 8 件から外れた古い画像をストレージから削除
    await cleanupUnusedInstagramImages(
      stylistId,
      mirrored.map((p) => p.imageUrl)
    );

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
