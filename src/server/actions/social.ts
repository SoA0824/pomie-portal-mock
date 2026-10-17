"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getSocialPostById, slideToRow } from "@/lib/data/social";
import { buildSlideContext, renderSlide } from "@/lib/social/render";
import { SOCIAL_BUCKET, socialStoragePath } from "@/lib/social/storage";
import sharp from "sharp";
import { SITE_URL } from "@/lib/site";
import { publishInstagram, publishThreads } from "@/lib/integrations/meta";
import { getUsableToken } from "@/lib/integrations/tokens";
import {
  HASHTAG_MAX,
  INSTAGRAM_CAPTION_LIMIT,
  THREADS_TEXT_LIMIT,
  X_WEIGHT_LIMIT,
  articleUrlFor,
  instagramCaptionFull,
  normalizeTag,
  xWeightedLength,
} from "@/lib/social/text";
import {
  INTEGRATION_PROVIDERS,
  SOCIAL_PLATFORMS,
  SOCIAL_TEMPLATES,
  type IntegrationProvider,
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
  threadsText: string;
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
  if (input.threadsText.length > THREADS_TEXT_LIMIT) return { ok: false, reason: `Threads の本文は ${THREADS_TEXT_LIMIT} 文字までです` };
  if (!SOCIAL_TEMPLATES.includes(input.template)) return { ok: false, reason: "テンプレートが不正です" };

  const wasReady = post.status === "ready";
  const patch: Record<string, unknown> = {
    caption,
    hashtags,
    alt_text: input.altText.trim() || null,
    x_text: input.xText.trim() || null,
    x_reply: input.xReply.trim() || null,
    threads_text: input.threadsText.trim() || null,
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
 * 書き出す: 文字を合成した最終画像（JPEG）を作って Storage に保存する。
 * これをダウンロードして投稿するか、API で投稿する（Instagram の API は JPEG のみ）。
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
      const png = Buffer.from(await res.arrayBuffer());
      const bytes = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      const path = `social/${post.id}/slide-${String(i + 1).padStart(2, "0")}-${stamp}.jpg`;
      const { error } = await sb.storage.from(SOCIAL_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
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

/**
 * API で投稿する（Instagram / Threads）。連携設定でトークンを登録してあることが前提。
 * 画像は書き出し済みの JPEG を公開 URL のまま渡す。
 */
export async function publishToPlatform(id: string, platform: IntegrationProvider): Promise<{ ok: true; url: string | null } | { ok: false; reason: string }> {
  if (!INTEGRATION_PROVIDERS.includes(platform)) return { ok: false, reason: "この媒体は API で投稿できません" };
  const post = await getSocialPostById(id);
  if (!post) return { ok: false, reason: "投稿が見つかりません" };
  if (!post.platforms.includes(platform)) return { ok: false, reason: "この投稿の媒体に含まれていません" };
  if (post.status === "rejected") return { ok: false, reason: "却下した投稿は投稿できません" };
  if (post.posted[platform]?.at) return { ok: false, reason: "すでに投稿済みです（やり直すなら先に取り消してください）" };
  if (post.renderedUrls.length === 0) return { ok: false, reason: "先に「書き出す」で画像を作ってください" };
  if (post.renderedUrls.some((u) => !/\.jpe?g(\?|$)/i.test(u))) {
    return { ok: false, reason: "書き出した画像が古い形式（PNG）です。もう一度「書き出す」を押してください" };
  }

  let token: string;
  try {
    token = (await getUsableToken(platform)).token;
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }

  try {
    let result: { mediaId: string; permalink: string | null };
    if (platform === "instagram") {
      const caption = instagramCaptionFull(post);
      if (!caption.trim()) return { ok: false, reason: "Instagram の本文がありません" };
      result = await publishInstagram({ token, imageUrls: post.renderedUrls, caption, altText: post.altText });
    } else {
      let text = (post.threadsText ?? "").trim();
      if (!text) return { ok: false, reason: "Threads の本文がありません" };
      if (!/https?:\/\//.test(text)) {
        const article = await getArticleByIdIncludingDrafts(post.articleId);
        if (article) text = `${text}\n${articleUrlFor(SITE_URL, article.slug, "threads")}`;
      }
      result = await publishThreads({ token, imageUrls: post.renderedUrls, text });
    }
    const posted = { ...post.posted, [platform]: { at: now(), url: result.permalink, externalId: result.mediaId } };
    const allDone = post.platforms.every((p) => posted[p]?.at);
    const { error } = await getSupabase()
      .from("social_posts")
      .update({ posted, ...(allDone ? { status: "posted" } : {}), error: null, updated_at: now() })
      .eq("id", id);
    if (error) return { ok: false, reason: `投稿はできましたが記録に失敗しました: ${error.message}` };
    revalidate(id);
    return { ok: true, url: result.permalink };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await getSupabase().from("social_posts").update({ error: `${platform} への投稿に失敗: ${reason}`, updated_at: now() }).eq("id", id);
    revalidate(id);
    return { ok: false, reason };
  }
}
