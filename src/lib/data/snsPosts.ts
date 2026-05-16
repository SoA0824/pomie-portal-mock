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
