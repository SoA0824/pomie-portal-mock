/**
 * Instagram CDN の画像 URL まわりのユーティリティ（Edge / Node 両対応）。
 *
 * Apify が返す画像 URL のホストは、スクレイピングした地域によって
 * `instagram.fcps4-2.fna.fbcdn.net` のような「プロバイダ網内限定のキャッシュ」
 * になることがある。これは一般には DNS で名前解決できず、Vercel からも
 * 取得できない。
 *
 * 署名（oh= / oe=）はパスとクエリに付いているため、ホストを公開 CDN に
 * 差し替えれば同じ画像を取得できる。
 */

/** 地域限定キャッシュが使えないときに試す公開 CDN ホスト（上から順に試す） */
const PUBLIC_HOSTS = ["scontent.cdninstagram.com", "scontent.xx.fbcdn.net"];

export function isInstagramCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /(?:^|\.)cdninstagram\.com|\.fbcdn\.net/.test(url);
}

/**
 * 取得を試す URL の候補を返す。
 * 元の URL → 公開 CDN ホストに差し替えた URL の順（重複は除く）。
 */
export function instagramCdnCandidates(url: string): string[] {
  const out = [url];
  try {
    const u = new URL(url);
    for (const host of PUBLIC_HOSTS) {
      if (u.hostname === host) continue;
      const alt = new URL(url);
      alt.hostname = host;
      out.push(alt.toString());
    }
  } catch {
    // URL として解釈できなければ元の URL だけ
  }
  return Array.from(new Set(out));
}

/** Instagram CDN から画像を取るときのヘッダー（ホットリンク防止対策） */
export const INSTAGRAM_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.instagram.com/",
  // AVIF 等で返されると保存・表示の互換性が落ちるので JPEG を優先して要求する
  Accept: "image/jpeg,image/webp;q=0.9,image/*;q=0.8",
};

/**
 * 候補 URL を順に試し、最初に画像が取れたレスポンスを返す。
 * どれも失敗したら null（失敗理由は reasons に入る）。
 */
export async function fetchInstagramImage(
  url: string,
  init: RequestInit = {}
): Promise<{ res: Response; usedUrl: string } | { res: null; reasons: string[] }> {
  const reasons: string[] = [];
  for (const candidate of instagramCdnCandidates(url)) {
    try {
      const res = await fetch(candidate, {
        ...init,
        headers: INSTAGRAM_FETCH_HEADERS,
        redirect: "follow",
      });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/")) {
        return { res, usedUrl: candidate };
      }
      reasons.push(`${new URL(candidate).hostname}: ${res.status} ${type}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "fetch_error";
      reasons.push(`${safeHost(candidate)}: ${msg}`);
    }
  }
  return { res: null, reasons };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}
