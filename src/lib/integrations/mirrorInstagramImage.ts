import { getSupabase } from "@/lib/supabase/client";

const BUCKET = "stylist-images";

/** Instagram CDN から画像を取るときのヘッダー（ホットリンク防止対策） */
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.instagram.com/",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 既に自前ストレージに取り込み済みの URL か（再取得の無駄を避ける） */
function isAlreadyMirrored(url: string): boolean {
  return url.includes("/storage/v1/object/public/");
}

/**
 * Instagram CDN の画像を Supabase Storage に複製し、期限切れしない公開 URL を返す。
 *
 * Instagram の画像 URL には有効期限つきトークン（`oe=`）が含まれており、
 * 数時間〜数日で 403 になって表示できなくなる。
 * そのため取得時に自前ストレージへ保存し、以後はそちらを配信する。
 *
 * 複製に失敗した場合は null を返す（呼び出し側で元 URL にフォールバックする）。
 */
export async function mirrorInstagramImage(
  stylistId: string,
  externalId: string,
  sourceUrl: string
): Promise<string | null> {
  if (!sourceUrl) return null;
  // 既に自前ストレージの URL ならそのまま使う
  if (isAlreadyMirrored(sourceUrl)) return sourceUrl;

  try {
    const res = await fetch(sourceUrl, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .trim();
    const ext = EXT_BY_MIME[contentType];
    // 画像以外が返ってきた場合は保存しない
    if (!ext) return null;

    const body = await res.arrayBuffer();
    if (body.byteLength === 0) return null;

    // externalId ごとに固定パスにするので、再同期時は同じ場所へ上書きされる
    const safeId = externalId.replace(/[^A-Za-z0-9_-]/g, "") || "post";
    const path = `instagram/${stylistId}/${safeId}.${ext}`;

    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(path, body, {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) return null;

    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * 最新の投稿に含まれなくなった古い画像をストレージから削除する。
 * 失敗しても同期自体は成功扱いにしたいので、例外は握りつぶす。
 */
export async function cleanupUnusedInstagramImages(
  stylistId: string,
  keepUrls: string[]
): Promise<void> {
  try {
    const sb = getSupabase();
    const dir = `instagram/${stylistId}`;
    const { data, error } = await sb.storage.from(BUCKET).list(dir, { limit: 100 });
    if (error || !data) return;

    const stale = data
      .map((f) => `${dir}/${f.name}`)
      .filter((path) => !keepUrls.some((url) => url.includes(path)));

    if (stale.length > 0) {
      await sb.storage.from(BUCKET).remove(stale);
    }
  } catch {
    // ストレージ掃除の失敗は同期結果に影響させない
  }
}
