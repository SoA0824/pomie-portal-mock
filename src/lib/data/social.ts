import type {
  SocialFormat,
  SocialImageSource,
  SocialPlatform,
  SocialPost,
  SocialSlide,
  SocialSlideKind,
  SocialTemplate,
} from "../types";
import { SOCIAL_PLATFORMS, SOCIAL_TEMPLATES } from "../types";
import { getSupabase, type SocialPostRow } from "@/lib/supabase/client";

const KINDS: SocialSlideKind[] = ["cover", "point", "cta"];
const SOURCES: SocialImageSource[] = ["none", "ai", "store", "upload"];
const FORMATS: SocialFormat[] = ["carousel", "single", "story"];

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * DB の slides（jsonb）を正規化する。
 * スクリプトは snake_case（image_url）、画面は camelCase（imageUrl）で書くので両方を受け付ける。
 */
export function normalizeSlide(raw: unknown, index: number, total: number): SocialSlide {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kindRaw = str(r.kind) as SocialSlideKind;
  const kind = KINDS.includes(kindRaw) ? kindRaw : index === 0 ? "cover" : index === total - 1 ? "cta" : "point";
  const sourceRaw = str(r.image_source ?? r.imageSource) as SocialImageSource;
  const imageUrl = str(r.image_url ?? r.imageUrl) || null;
  const templateRaw = str(r.template) as SocialTemplate;
  return {
    kind,
    headline: str(r.headline),
    body: str(r.body),
    imageSource: SOURCES.includes(sourceRaw) ? sourceRaw : imageUrl ? "upload" : "none",
    imagePrompt: str(r.image_prompt ?? r.imagePrompt) || null,
    imageUrl,
    template: SOCIAL_TEMPLATES.includes(templateRaw) ? templateRaw : null,
  };
}

/** 画面で編集したスライドを DB に書く形（snake_case）にする */
export function slideToRow(slide: SocialSlide): Record<string, unknown> {
  return {
    kind: slide.kind,
    headline: slide.headline,
    body: slide.body,
    image_source: slide.imageSource,
    image_prompt: slide.imagePrompt,
    image_url: slide.imageUrl,
    template: slide.template,
  };
}

export function rowToSocialPost(row: SocialPostRow): SocialPost {
  const slidesRaw = Array.isArray(row.slides) ? row.slides : [];
  const platforms = (row.platforms ?? []).filter((p): p is SocialPlatform => (SOCIAL_PLATFORMS as readonly string[]).includes(p));
  const template = (SOCIAL_TEMPLATES as readonly string[]).includes(row.template ?? "") ? (row.template as SocialTemplate) : "photo";
  const posted: SocialPost["posted"] = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = row.posted?.[p];
    if (v?.at) posted[p] = { at: v.at, url: v.url ?? null };
  }
  return {
    id: row.id,
    articleId: row.article_id,
    platforms: platforms.length ? platforms : ["instagram"],
    format: FORMATS.includes(row.format as SocialFormat) ? (row.format as SocialFormat) : "carousel",
    status: row.status,
    brief: row.brief ?? "",
    template,
    caption: row.caption,
    hashtags: row.hashtags ?? [],
    altText: row.alt_text,
    xText: row.x_text,
    xReply: row.x_reply,
    slides: slidesRaw.map((s, i) => normalizeSlide(s, i, slidesRaw.length)),
    imageProvider: row.image_provider,
    imageModel: row.image_model,
    rawImageUrls: row.raw_image_urls ?? [],
    renderedUrls: row.rendered_urls ?? [],
    renderedAt: row.rendered_at,
    imageRequest: row.image_request,
    photoConsent: row.photo_consent,
    lint: row.lint,
    error: row.error,
    posted,
    requestedAt: row.requested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 一覧（新しい順）。テーブルが無いときは error に理由（画面で migration の案内をする） */
export async function listSocialPosts(): Promise<{ posts: SocialPost[]; error: string | null }> {
  const { data, error } = await getSupabase().from("social_posts").select("*").order("updated_at", { ascending: false });
  if (error) return { posts: [], error: error.message };
  return { posts: (data ?? []).map((r) => rowToSocialPost(r as SocialPostRow)), error: null };
}

export async function getSocialPostById(id: string): Promise<SocialPost | null> {
  const { data, error } = await getSupabase().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToSocialPost(data as SocialPostRow);
}

export type SocialCounts = { requested: number; draft: number; ready: number; posted: number };

/** 記事一覧の表示用: 記事ごとの SNS 投稿の件数 */
export async function getSocialCountsByArticle(): Promise<Map<string, SocialCounts>> {
  const map = new Map<string, SocialCounts>();
  const { data, error } = await getSupabase().from("social_posts").select("article_id, status");
  if (error) return map;
  for (const r of data ?? []) {
    const c = map.get(r.article_id) ?? { requested: 0, draft: 0, ready: 0, posted: 0 };
    if (r.status in c) c[r.status as keyof SocialCounts] += 1;
    map.set(r.article_id, c);
  }
  return map;
}
