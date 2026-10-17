/**
 * スライドを画像（PNG）にする。
 *
 * - 文字はブランド設定のフォント（既定 Noto Sans JP）。日本語フォントは大きいので、スライドに出る文字だけを
 *   Google Fonts から部分取得する（取得結果はプロセス内でキャッシュ）
 * - 背景画像は公開 URL（Storage）か、サイト内のパス（店舗写真）を絶対 URL にして渡す
 */
import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";
import { BRAND } from "./brand";
import type { SocialPost } from "@/lib/types";
import { SLIDE_HEIGHT, SLIDE_WIDTH, collectSlideText, createSlideElement, type SlideContext } from "./templates";

// この UA だと Google Fonts が TTF を返す（satori は woff2 を読めない）
const FONT_UA = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
const fontCache = new Map<string, Promise<ArrayBuffer>>();

async function loadFont(weight: 400 | 700, text: string): Promise<ArrayBuffer> {
  const chars = Array.from(new Set(Array.from(text))).join("");
  const key = `${weight}:${chars}`;
  const hit = fontCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${BRAND.font.googleFamily}:wght@${weight}&text=${encodeURIComponent(chars)}`;
    const css = await fetch(cssUrl, { headers: { "User-Agent": FONT_UA } }).then((r) => {
      if (!r.ok) throw new Error(`フォントの取得に失敗しました（${r.status}）`);
      return r.text();
    });
    const m = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/) ?? css.match(/url\(([^)]+)\)/);
    if (!m) throw new Error("フォントの URL が見つかりませんでした");
    const font = await fetch(m[1]);
    if (!font.ok) throw new Error(`フォントのダウンロードに失敗しました（${font.status}）`);
    return font.arrayBuffer();
  })();
  if (fontCache.size > 300) fontCache.clear();
  fontCache.set(key, p);
  p.catch(() => fontCache.delete(key));
  return p;
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** スライドに出す共通の文字（店舗名・エリアは出さない） */
export function buildSlideContext(_article?: { areas: string[] } | null): SlideContext {
  return { siteLabel: SITE_URL.replace(/^https?:\/\//, "") };
}

/**
 * スライド 1 枚を描画する。width を小さくするとプレビュー用に縮小して描く（最大 1080）。
 */
export async function renderSlide(post: SocialPost, ctx: SlideContext, index: number, opts: { width?: number } = {}): Promise<ImageResponse> {
  const slide = post.slides[index];
  if (!slide) throw new Error(`スライド ${index + 1} がありません`);
  const width = Math.round(Math.min(Math.max(opts.width ?? SLIDE_WIDTH, 200), SLIDE_WIDTH));
  const scale = width / SLIDE_WIDTH;
  const text = collectSlideText(post, index, ctx);
  const [regular, bold] = await Promise.all([loadFont(400, text), loadFont(700, text)]);
  return new ImageResponse(createSlideElement({ post, index, ctx, scale, imageUrl: resolveImageUrl(slide.imageUrl) }), {
    width,
    height: Math.round(SLIDE_HEIGHT * scale),
    fonts: [
      { name: BRAND.font.family, data: regular, weight: 400, style: "normal" },
      { name: BRAND.font.family, data: bold, weight: 700, style: "normal" },
    ],
    headers: { "Cache-Control": "no-store" },
  });
}
