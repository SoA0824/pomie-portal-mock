/**
 * 画像 URL が Instagram CDN なら自前のプロキシ経由 URL に書き換える。
 * それ以外はそのまま返す。
 */
export function proxyIfInstagram(url: string | undefined | null): string {
  if (!url) return "";
  if (/(?:^|\.)cdninstagram\.com|\.fbcdn\.net/.test(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}
