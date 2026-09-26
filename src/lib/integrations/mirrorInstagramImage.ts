import { getSupabase } from "@/lib/supabase/client";
import { STORAGE_BUCKET as BUCKET } from "@/lib/storage";
import { fetchInstagramImage } from "@/lib/instagramCdn";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 既に自前ストレージに取り込み済みの URL か（再取得の無駄を避ける） */
function isAlreadyMirrored(url: string): boolean {
  return url.includes("/storage/v1/object/public/");
}

function safeId(externalId: string): string {
  return externalId.replace(/[^A-Za-z0-9_-]/g, "") || "post";
}

function folderOf(stylistId: string): string {
  return `instagram/${stylistId}`;
}

/**
 * 美容師の Instagram 画像フォルダに既にあるファイルを
 * 「投稿 ID → 公開 URL」の形で返す。
 * 今回の複製に失敗した投稿でも、前回までに保存済みならそれを使えるようにするため。
 */
export async function listMirroredInstagramImages(
  stylistId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const sb = getSupabase();
    const dir = folderOf(stylistId);
    const { data } = await sb.storage.from(BUCKET).list(dir, { limit: 100 });
    for (const f of data ?? []) {
      const id = f.name.replace(/\.[^.]+$/, "");
      map.set(id, sb.storage.from(BUCKET).getPublicUrl(`${dir}/${f.name}`).data.publicUrl);
    }
  } catch {
    // 一覧が取れなくても複製処理は続ける
  }
  return map;
}

/**
 * Instagram CDN の画像を Supabase Storage に複製し、期限切れしない公開 URL を返す。
 *
 * Instagram の画像 URL には有効期限つきトークン（`oe=`）が含まれ、さらに
 * ホストが地域限定キャッシュ（*.fna.fbcdn.net）でそもそも取得できないことがある。
 * 元 URL → 公開 CDN ホストの順に試し、取れた画像を自前ストレージへ保存する。
 *
 * 複製できなかった場合は null を返す（期限つき URL は保存しないこと）。
 */
export async function mirrorInstagramImage(
  stylistId: string,
  externalId: string,
  sourceUrl: string
): Promise<string | null> {
  if (!sourceUrl) return null;
  if (isAlreadyMirrored(sourceUrl)) return sourceUrl;

  const fetched = await fetchInstagramImage(sourceUrl, { cache: "no-store" });
  if (!fetched.res) {
    console.warn(
      `[instagram] 画像の取得に失敗 stylist=${stylistId} post=${externalId}: ${fetched.reasons.join(" / ")}`
    );
    return null;
  }

  try {
    const contentType = (fetched.res.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const ext = EXT_BY_MIME[contentType];
    if (!ext) {
      console.warn(
        `[instagram] 未対応の画像形式 stylist=${stylistId} post=${externalId}: ${contentType}`
      );
      return null;
    }

    const body = await fetched.res.arrayBuffer();
    if (body.byteLength === 0) return null;

    // 投稿 ID ごとに固定パスにするので、再同期時は同じ場所へ上書きされる
    const path = `${folderOf(stylistId)}/${safeId(externalId)}.${ext}`;

    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(path, body, {
      contentType: contentType === "image/jpg" ? "image/jpeg" : contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) {
      console.warn(
        `[instagram] ストレージへの保存に失敗 stylist=${stylistId} post=${externalId}: ${error.message}`
      );
      return null;
    }

    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.warn(
      `[instagram] 画像の保存中にエラー stylist=${stylistId} post=${externalId}: ${
        err instanceof Error ? err.message : err
      }`
    );
    return null;
  }
}

/** 投稿 ID から、前回までに保存済みの画像 URL を探す */
export function findPreviouslyMirrored(
  existing: Map<string, string>,
  externalId: string
): string | null {
  return existing.get(safeId(externalId)) ?? null;
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
    const dir = folderOf(stylistId);
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
