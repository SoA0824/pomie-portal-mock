/** SNS 投稿の画像の保存先（supabase/migration-013-social-posts.sql で作る公開バケット） */
export const SOCIAL_BUCKET = "social-images";

const PUBLIC_PREFIX = `/storage/v1/object/public/${SOCIAL_BUCKET}/`;

/** 公開 URL からバケット内のパスを取り出す。このバケットの URL でなければ null */
export function socialStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const idx = url.indexOf(PUBLIC_PREFIX);
  if (idx === -1) return null;
  const path = url.slice(idx + PUBLIC_PREFIX.length).split("?")[0];
  return path || null;
}
