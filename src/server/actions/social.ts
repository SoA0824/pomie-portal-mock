"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getSocialPostById, slideToRow } from "@/lib/data/social";
import { buildSlideContext, renderSlide } from "@/lib/social/render";
import { SOCIAL_BUCKET, socialStoragePath } from "@/lib/social/storage";
import { HASHTAG_MAX, INSTAGRAM_CAPTION_LIMIT, X_WEIGHT_LIMIT, normalizeTag, xWeightedLength } from "@/lib/social/text";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_TEMPLATES,
  type SocialFormat,
  type SocialPlatform,
  type SocialSlide,
  type SocialTemplate,
} from "@/lib/types";

type Result = { ok: true } | { ok: false; reason: string };
type RequestResult = { ok: true; id: string } | { ok: false; reason: string };

const MAX_SLIDES = 8;

function now() {
  return new Date().toISOString();
}

function newSocialId() {
  return `sp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function revalidate(id?: string) {
  revalidatePath("/admin/social");
  revalidatePath("/admin/articles");
  if (id) revalidatePath(`/admin/social/${id}`);
}

async function removeStorageUrls(urls: string[]) {
  const paths = urls.map(socialStoragePath).filter((p): p is string => Boolean(p));
  if (!paths.length) return;
  try {
    await getSupabase().storage.from(SOCIAL_BUCKET).remove(paths);
  } catch {
    // 消せなくても致命的ではない
  }
}

/**
 * SNS 投稿を依頼する（記事一覧）。
 * 「依頼済み」として保存され、Claude Code の /make-social-post が投稿文・スライド・画像を作る。
 */
export async function requestSocialPost(input: {
  articleId: string;
  platforms: SocialPlatform[];
  format?: SocialFormat;
  brief?: string;
  photoConsent?: string;
}): Promise<RequestResult> {
  const platforms = Array.from(new Set(input.platforms)).filter((p) => SOCIAL_PLATFORMS.includes(p));
  if (platforms.length === 0) return { ok: false, reason: "出す媒体を 1 つ以上選んでください" };
  const sb = getSupabase();
  const { data: article, error: aErr } = await sb.from("articles").select("id, status").eq("id", input.articleId).maybeSingle();
  if (aErr) return { ok: false, reason: aErr.message };
  if (!article) return { ok: false, reason: "記事が見つかりません" };
  if (article.status !== "published") return { ok: false, reason: "公開中の記事だけ SNS 投稿を作れます（先に記事を公開してください）" };

  const id = newSocialId();
  const { error } = await sb.from("social_posts").insert({
    id,
    article_id: input.articleId,
    platforms,
    format: input.format ?? "carousel",
    status: "requested",
    brief: (input.brief ?? "").trim(),
    photo_consent: input.photoConsent?.trim() || null,
  });
  if (error) return { ok: false, reason: error.message };
  revalidate();
  return { ok: true, id };
}

export type SocialPostUpdate = {
  caption: string;
  hashtags: string[];
  altText: string;
  xText: string;
  xReply: string;
  template: SocialTemplate;
  slides: SocialSlide[];
};

/** 管理画面での編集を保存する。書き出し済みだった場合は最終画像を作り直す必要があるので「下書き」に戻す */
export async function updateSocialPost(id: string, input: SocialPostUpdate): Promise<Result> {
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  if (post.status === "rejected") return { ok: false, reason: "却下した投稿は編集できません" };

  const slides = input.slides.map((s, i) => ({
    kind: s.kind,
    headline: s.headline.trim(),
    body: s.body.trim(),
    imageSource: s.imageSource,
    imagePrompt: s.imagePrompt?.trim() || null,
    imageUrl: s.imageUrl?.trim() || null,
    template: s.template && SOCIAL_TEMPLATES.includes(s.template) ? s.template : null,
    index: i,
  }));
  if (slides.length === 0) return { ok: false, reason: "スライドが 1 枚もありません" };
  if (slides.length > MAX_SLIDES) return { ok: false, reason: `スライドは ${MAX_SLIDES} 枚までです` };
  for (const s of slides) {
    if (!s.headline) return { ok: false, reason: `スライド ${s.index + 1} の見出しを入力してください` };
    if (s.imageUrl && !/^(https?:\/\/|\/)/.test(s.imageUrl)) return { ok: false, reason: `スライド ${s.index + 1} の画像 URL が不正です` };
  }
  const hashtags = Array.from(new Set(input.hashtags.map(normalizeTag).filter(Boolean)));
  if (hashtags.length > HASHTAG_MAX) return { ok: false, reason: `ハッシュタグは ${HASHTAG_MAX} 個までです（今 ${hashtags.length} 個）` };
  const caption = input.caption.trim();
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) return { ok: false, reason: `Instagram の本文は ${INSTAGRAM_CAPTION_LIMIT} 文字までです` };
  for (const [label, text] of [
    ["X の本文", input.xText],
    ["X の返信", input.xReply],
  ] as const) {
    if (xWeightedLength(text) > X_WEIGHT_LIMIT) return { ok: false, reason: `${label}が長すぎます（日本語換算 ${X_WEIGHT_LIMIT / 2} 文字まで）` };
  }
  if (!SOCIAL_TEMPLATES.includes(input.template)) return { ok: false, reason: "テンプレートが不正です" };

  const wasReady = post.status === "ready";
  const patch: Record<string, unknown> = {
    caption,
    hashtags,
    alt_text: input.altText.trim() || null,
    x_text: input.xText.trim() || null,
    x_reply: input.xReply.trim() || null,
    template: input.template,
    slides: slides.map(({ index: _i, ...s }) => slideToRow(s)),
    updated_at: now(),
    ...(wasReady ? { status: "draft", rendered_urls: [], rendered_at: null } : {}),
  };
  const { error } = await getSupabase().from("social_posts").update(patch).eq("id", id);
  if (error) return { ok: false, reason: error.message };
  if (wasReady) await removeStorageUrls(post.renderedUrls);
  revalidate(id);
  return { ok: true };
}

/** 画像の作り直しを依頼する（Claude Code の /make-social-post が拾う） */
export async function requestImageRegeneration(id: string, note: string): Promise<Result> {
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  if (post.status === "posted" || post.status === "rejected") return { ok: false, reason: "この投稿は作り直せません" };
  const { error } = await getSupabase()
    .from("social_posts")
    .update({ status: "requested", image_request: note.trim() || "画像を作り直してください", updated_at: now() })
    .eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidate(id);
  return { ok: true };
}

/**
 * 書き出す: 文字を合成した最終画像（PNG）を作って Storage に保存する。
 * これをダウンロードして投稿する。
 */
export async function exportSocialPost(id: string): Promise<Result> {
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  if (post.status === "requested") return { ok: false, reason: "まだ投稿文とスライドが作られていません" };
  if (post.status === "rejected") return { ok: false, reason: "却下した投稿は書き出せません" };
  if (post.slides.length === 0) return { ok: false, reason: "スライドがありません" };
  for (const [i, s] of post.slides.entries()) {
    if (!s.headline.trim()) return { ok: false, reason: `スライド ${i + 1} の見出しが空です` };
  }

  const article = await getArticleByIdIncludingDrafts(post.articleId);
  const ctx = buildSlideContext(article);
  const sb = getSupabase();
  const stamp = Date.now().toString(36);
  const urls: string[] = [];
  try {
    for (let i = 0; i < post.slides.length; i++) {
      const res = await renderSlide(post, ctx, i);
      const bytes = Buffer.from(await res.arrayBuffer());
      const path = `social/${post.id}/slide-${String(i + 1).padStart(2, "0")}-${stamp}.png`;
      const { error } = await sb.storage.from(SOCIAL_BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
      if (error) throw new Error(`画像の保存に失敗しました（${error.message}）。migration-013 で social-images バケットを作ってください`);
      urls.push(sb.storage.from(SOCIAL_BUCKET).getPublicUrl(path).data.publicUrl);
    }
  } catch (err) {
    await removeStorageUrls(urls);
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }

  const { error } = await sb
    .from("social_posts")
    .update({
      rendered_urls: urls,
      rendered_at: now(),
      status: post.status === "posted" ? "posted" : "ready",
      error: null,
      updated_at: now(),
    })
    .eq("id", id);
  if (error) return { ok: false, reason: error.message };
  await removeStorageUrls(post.renderedUrls);
  revalidate(id);
  return { ok: true };
}

/** 投稿済みにする（媒体ごと）。すべての媒体に投稿したら状態が「投稿済み」になる */
export async function markPosted(id: string, platform: SocialPlatform, url: string): Promise<Result> {
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  if (!SOCIAL_PLATFORMS.includes(platform)) return { ok: false, reason: "媒体が不正です" };
  const trimmed = url.trim();
  if (trimmed && !/^https:\/\//.test(trimmed)) return { ok: false, reason: "投稿 URL は https:// から始めてください" };
  const posted = { ...post.posted, [platform]: { at: now(), url: trimmed || null } };
  const allDone = post.platforms.every((p) => posted[p]?.at);
  const { error } = await getSupabase()
    .from("social_posts")
    .update({ posted, ...(allDone ? { status: "posted" } : {}), updated_at: now() })
    .eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidate(id);
  return { ok: true };
}

/** 投稿済みを取り消す（間違えたとき） */
export async function clearPosted(id: string, platform: SocialPlatform): Promise<Result> {
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  const posted = { ...post.posted };
  delete posted[platform];
  const status = post.status === "posted" ? (post.renderedUrls.length ? "ready" : "draft") : post.status;
  const { error } = await getSupabase().from("social_posts").update({ posted, status, updated_at: now() }).eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidate(id);
  return { ok: true };
}

export async function rejectSocialPost(id: string): Promise<Result> {
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  if (post.status === "posted") return { ok: false, reason: "投稿済みのものは却下できません（削除してください）" };
  const { error } = await getSupabase().from("social_posts").update({ status: "rejected", updated_at: now() }).eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidate(id);
  return { ok: true };
}

/** 投稿と画像をすべて削除する */
export async function deleteSocialPost(id: string): Promise<Result> {
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  const sb = getSupabase();
  try {
    const { data } = await sb.storage.from(SOCIAL_BUCKET).list(`social/${post.id}`, { limit: 200 });
    const paths = (data ?? []).map((f) => `social/${post.id}/${f.name}`);
    if (paths.length) await sb.storage.from(SOCIAL_BUCKET).remove(paths);
  } catch {
    // 画像が消せなくても投稿は消す
  }
  const { error } = await sb.from("social_posts").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidate();
  return { ok: true };
}
