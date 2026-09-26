"use server";

import { revalidatePath } from "next/cache";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { replaceInstagramPosts } from "@/lib/data/snsPosts";
import { getInstagramFetcher } from "@/lib/integrations/instagram";
import {
  mirrorInstagramImage,
  cleanupUnusedInstagramImages,
  listMirroredInstagramImages,
  findPreviouslyMirrored,
} from "@/lib/integrations/mirrorInstagramImage";
import { isInstagramCdnUrl } from "@/lib/instagramCdn";
import { getSupabase } from "@/lib/supabase/client";

export type SyncResult =
  | {
      ok: true;
      count: number;
      /** 画像を保存できず掲載を見送った投稿数 */
      skipped: number;
      via: "apify" | "mock";
    }
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

    // Instagram CDN の URL は有効期限つきトークンを含み、時間が経つと表示できなくなる。
    // さらにホストが地域限定キャッシュ（*.fna.fbcdn.net）で最初から取得できないこともある。
    // そのため取得時に自前の Supabase Storage へ複製し、期限切れしない URL に差し替える。
    //
    // 複製できなかった投稿の扱い:
    //   1) 前回までに保存済みの画像があればそれを使う
    //   2) それも無ければその投稿は掲載しない
    // 期限つきの CDN URL は絶対に保存しない（保存すると後から空白の画像になるため）。
    const previouslyMirrored = await listMirroredInstagramImages(stylistId);

    const results = await mapWithConcurrency(posts, 3, async (p) => {
      // Instagram 以外の画像（モック等）は期限切れしないのでそのまま
      if (!isInstagramCdnUrl(p.imageUrl)) return p;

      const url =
        (await mirrorInstagramImage(stylistId, p.externalId, p.imageUrl)) ??
        findPreviouslyMirrored(previouslyMirrored, p.externalId);
      return url ? { ...p, imageUrl: url } : null;
    });

    const mirrored = results.filter((p): p is (typeof posts)[number] => p !== null);
    const skipped = posts.length - mirrored.length;

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

    return { ok: true, count, skipped, via };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return { ok: false, reason: message };
  }
}

/** 同時実行数を絞って順に処理する（CDN への一斉アクセスで弾かれるのを避ける） */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
