/**
 * SNS 投稿の文字まわりのルール（ブラウザ・サーバー・どちらでも使う）。
 * scripts/social/lib.mjs にも同じルールがあるので、変えるときは両方を直す。
 */
import { AREAS } from "@/lib/areas";
import type { SocialPost } from "@/lib/types";

/** いつも付けるブランドのタグ。エリアを後ろに付けた形（#pomie表参道 など）も付ける */
export const BRAND_TAGS = ["pomie", "ポミエ"];
/** いつも付ける固定のタグ（美容師の採用にもつなげる） */
export const FIXED_TAGS = ["シェアサロン", "フリーランス美容師", "美容師独立"];

export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const HASHTAG_MAX = 30;
export const HASHTAG_RECOMMENDED = { min: 8, max: 20 };
/** X の重み付き文字数の上限（日本語は 1 文字 2、URL は 23） */
export const X_WEIGHT_LIMIT = 280;

export function requiredHashtags(areaSlugs: string[]): string[] {
  const names = areaSlugs.map((s) => AREAS.find((a) => a.slug === s)?.name).filter((n): n is string => Boolean(n));
  return [...BRAND_TAGS, ...names.flatMap((n) => BRAND_TAGS.map((b) => `${b}${n}`)), ...FIXED_TAGS];
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^[#＃]+/, "").replace(/[\s　]+/g, "");
}

/** 「#a #b」「a, b」「1 行 1 つ」のどれでも受け付ける */
export function parseHashtags(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s　,、]+/)) {
    const t = normalizeTag(raw);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function hashtagsToText(tags: string[]): string {
  return tags.map((t) => `#${normalizeTag(t)}`).filter((t) => t.length > 1).join(" ");
}

/** Instagram に貼る本文（本文 + 空行 + ハッシュタグ） */
export function instagramCaptionFull(post: Pick<SocialPost, "caption" | "hashtags">): string {
  return [post.caption?.trim() ?? "", hashtagsToText(post.hashtags)].filter(Boolean).join("\n\n");
}

const URL_RE = /https?:\/\/[^\s]+/g;

/** X の文字数（重み付き）。全角・絵文字は 2、半角は 1、URL は長さに関係なく 23 */
export function xWeightedLength(text: string): number {
  let total = 0;
  const rest = text.replace(URL_RE, () => {
    total += 23;
    return "";
  });
  for (const ch of rest) {
    const cp = ch.codePointAt(0) ?? 0;
    total += cp <= 0x10ff ? 1 : 2;
  }
  return total;
}

/** 表示用: 「あと n 文字（日本語換算）」 */
export function xRemainingJa(text: string): number {
  return Math.floor((X_WEIGHT_LIMIT - xWeightedLength(text)) / 2);
}

/** X の返信に載せる記事 URL（どの投稿から来たか GA で分かるように UTM を付ける） */
export function articleUrlForX(siteUrl: string, slug: string): string {
  return `${siteUrl}/articles/${slug}?utm_source=x&utm_medium=social&utm_campaign=${encodeURIComponent(slug)}`;
}
