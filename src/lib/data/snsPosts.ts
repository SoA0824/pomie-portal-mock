import type { SnsPost, SnsPlatform } from "../types";
import { getSupabase, type SnsPostRow } from "@/lib/supabase/client";

function rowToPost(row: SnsPostRow): SnsPost {
  return {
    id: row.id,
    stylistId: row.stylist_id,
    platform: row.platform as SnsPlatform,
    imageUrl: row.image_url,
    caption: row.caption,
    postedAt: row.posted_at,
  };
}

export async function getSnsPostsByStylistId(stylistId: string): Promise<SnsPost[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("sns_posts")
    .select("*")
    .eq("stylist_id", stylistId)
    .order("posted_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch sns posts: ${error.message}`);
  return (data ?? []).map(rowToPost);
}

/**
 * 画像 URL が Instagram CDN のまま（＝自前ストレージに複製されていない）投稿を
 * 持つ美容師の ID を返す。
 *
 * CDN の URL は有効期限つきトークンを含み、時間が経つと画像が表示できなくなる。
 * 該当する美容師は管理画面を開いたときに自動で再取得させ、複製済みの URL に
 * 置き換える。
 */
export async function getStylistIdsWithExpiringImages(): Promise<string[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("sns_posts")
    .select("stylist_id, image_url")
    .eq("platform", "instagram");
  if (error) return [];

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const url = (row as { image_url?: string }).image_url ?? "";
    if (/cdninstagram\.com|\.fbcdn\.net/.test(url)) {
      ids.add((row as { stylist_id: string }).stylist_id);
    }
  }
  return Array.from(ids);
}

export async function replaceInstagramPosts(
  stylistId: string,
  posts: Array<{
    externalId: string;
    imageUrl: string;
    caption: string;
    postedAt: string;
    sourceUrl?: string;
  }>
): Promise<number> {
  const sb = getSupabase();
  // 既存の Instagram 投稿を削除して最新 N 件で置き換え
  const { error: delError } = await sb
    .from("sns_posts")
    .delete()
    .eq("stylist_id", stylistId)
    .eq("platform", "instagram");
  if (delError) throw new Error(`Failed to clear old posts: ${delError.message}`);

  if (posts.length === 0) return 0;

  const rows = posts.map((p, i) => ({
    id: `ig-${stylistId}-${p.externalId || i}`,
    stylist_id: stylistId,
    platform: "instagram",
    image_url: p.imageUrl,
    caption: p.caption,
    posted_at: p.postedAt,
    source_url: p.sourceUrl ?? null,
    external_id: p.externalId ?? null,
  }));
  const { error: insError } = await sb.from("sns_posts").insert(rows);
  if (insError) throw new Error(`Failed to insert posts: ${insError.message}`);
  return rows.length;
}
