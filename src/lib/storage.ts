import { getSupabase } from "@/lib/supabase/client";

export const STORAGE_BUCKET = "stylist-images";

const PUBLIC_PREFIX = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

/**
 * 自前ストレージの公開 URL から、バケット内のパスを取り出す。
 * 自前ストレージの URL でなければ null。
 */
export function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const idx = url.indexOf(PUBLIC_PREFIX);
  if (idx === -1) return null;
  const path = url.slice(idx + PUBLIC_PREFIX.length).split("?")[0];
  return path || null;
}

/**
 * 自前ストレージのファイルを削除する。
 * 自前ストレージ以外の URL（外部の画像ホスト等）は無視する。
 * 失敗しても呼び出し側の処理は続行させたいので例外は投げない。
 */
export async function deleteStorageObjectByUrl(url: string | null | undefined): Promise<void> {
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  try {
    await getSupabase().storage.from(STORAGE_BUCKET).remove([path]);
  } catch {
    // 消せなくても致命的ではない（孤児ファイルが残るだけ）
  }
}
