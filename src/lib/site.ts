/**
 * サイト全体の基本情報（SEO・OGP・構造化データで使う）。
 * 本番ドメインが変わったら NEXT_PUBLIC_SITE_URL を設定する。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://portal.pomie.jp").replace(
  /\/$/,
  ""
);

export const SITE_NAME = "POMiE Portal";

export const SITE_DESCRIPTION =
  "ポミエ契約美容師に出会えるポータル。記事や診断から、あなたに合う美容師を見つけて予約できます。";

/** Google アナリティクス 4 の測定 ID（公開情報。環境変数で上書き可） */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-B7M5FQX839";

/** OGP の既定画像（トップのメインビジュアル） */
export const DEFAULT_OG_IMAGE = "/images/hero/hero.jpg";

/** 相対パスを絶対 URL にする（構造化データは絶対 URL が必要） */
export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** 説明文を検索結果に収まる長さに切る */
export function truncate(text: string, max = 120): string {
  const plain = text.replace(/[#*_>`\[\]()!-]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}
