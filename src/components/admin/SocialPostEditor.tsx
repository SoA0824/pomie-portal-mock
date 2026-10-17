"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import {
  clearPosted,
  deleteSocialPost,
  exportSocialPost,
  markPosted,
  rejectSocialPost,
  requestImageRegeneration,
  updateSocialPost,
} from "@/server/actions/social";
import { PLATFORM_LABEL, SLIDE_KIND_LABEL, SOCIAL_STATUS_LABEL, TEMPLATE_LABEL } from "@/lib/social/labels";
import {
  HASHTAG_MAX,
  HASHTAG_RECOMMENDED,
  X_WEIGHT_LIMIT,
  hashtagsToText,
  instagramCaptionFull,
  parseHashtags,
  requiredHashtags,
  xWeightedLength,
} from "@/lib/social/text";
import { formatDateTime } from "@/lib/format";
import {
  SOCIAL_TEMPLATES,
  type Article,
  type SocialImageSource,
  type SocialPlatform,
  type SocialPost,
  type SocialSlide,
  type SocialSlideKind,
  type SocialTemplate,
  type Store,
} from "@/lib/types";

const MAX_SLIDES = 8;
const KINDS: SocialSlideKind[] = ["cover", "point", "cta"];

const emptySlide = (kind: SocialSlideKind): SocialSlide => ({
  kind,
  headline: "",
  body: "",
  imageSource: "none",
  imagePrompt: null,
  imageUrl: null,
  template: null,
});

/**
 * SNS 投稿の詳細: プレビュー・文言と画像の編集・書き出し・投稿済みの記録。
 * プレビューは保存した内容で描かれる（編集中の内容は「保存」で反映）。
 */
export function SocialPostEditor({ post, article, stores }: { post: SocialPost; article: Article | null; stores: Store[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [hashtagsText, setHashtagsText] = useState(hashtagsToText(post.hashtags));
  const [altText, setAltText] = useState(post.altText ?? "");
  const [xText, setXText] = useState(post.xText ?? "");
  const [xReply, setXReply] = useState(post.xReply ?? "");
  const [template, setTemplate] = useState<SocialTemplate>(post.template);
  const [slides, setSlides] = useState<SocialSlide[]>(post.slides);
  const [dirty, setDirty] = useState(false);
  const [imageNote, setImageNote] = useState("");
  const [postUrls, setPostUrls] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [downloading, setDownloading] = useState(false);

  const status = SOCIAL_STATUS_LABEL[post.status];
  const hashtags = useMemo(() => parseHashtags(hashtagsText), [hashtagsText]);
  const missingTags = useMemo(() => requiredHashtags(article?.areas ?? []).filter((t) => !hashtags.includes(t)), [article, hashtags]);
  const storePhotos = useMemo(() => {
    const out: Array<{ url: string; label: string }> = [];
    for (const s of stores) {
      for (const u of [s.image, ...(s.gallery ?? [])]) {
        if (u && !out.some((p) => p.url === u)) out.push({ url: u, label: s.name });
      }
    }
    return out;
  }, [stores]);

  const touch = () => setDirty(true);
  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>, done: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setMessage(done);
        after?.();
        router.refresh();
      } else {
        setMessage(`失敗しました: ${r.reason}`);
      }
    });
  };

  const save = () =>
    run(
      () => updateSocialPost(post.id, { caption, hashtags, altText, xText, xReply, template, slides }),
      "保存しました（プレビューを更新しました）",
      () => setDirty(false)
    );

  const exportImages = () => {
    if (dirty) {
      setMessage("保存していない変更があります。先に「保存」してください");
      return;
    }
    run(() => exportSocialPost(post.id), "書き出しました。下の画像をダウンロードして投稿してください");
  };

  const updateSlide = (i: number, patch: Partial<SocialSlide>) => {
    setSlides((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    touch();
  };
  const moveSlide = (i: number, dir: -1 | 1) => {
    setSlides((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  };
  const removeSlide = (i: number) => {
    if (!window.confirm(`スライド ${i + 1} を削除しますか？`)) return;
    setSlides((cur) => cur.filter((_, idx) => idx !== i));
    touch();
  };
  const addSlide = () => {
    setSlides((cur) => {
      const cta = cur.findIndex((s) => s.kind === "cta");
      const slide = emptySlide("point");
      return cta === -1 ? [...cur, slide] : [...cur.slice(0, cta), slide, ...cur.slice(cta)];
    });
    touch();
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label}をコピーしました`);
    } catch {
      setMessage("コピーできませんでした。テキストを選択してコピーしてください");
    }
  };

  const downloadAll = async () => {
    setDownloading(true);
    try {
      for (const [i, url] of post.renderedUrls.entries()) {
        const blob = await fetch(url).then((r) => r.blob());
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${article?.slug ?? post.id}-${String(i + 1).padStart(2, "0")}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch {
      setMessage("ダウンロードできませんでした。画像を開いて保存してください");
    } finally {
      setDownloading(false);
    }
  };

  const previewSrc = (i: number) => `/admin/api/social/slide?post=${post.id}&i=${i}&w=540&v=${encodeURIComponent(post.updatedAt)}`;
  const xLen = xWeightedLength(xText);
  const xReplyLen = xWeightedLength(xReply);
  const hasContent = post.slides.length > 0 || Boolean(post.caption);
  const editable = post.status !== "rejected";

  return (
    <div className="mt-3 space-y-6">
      {/* ヘッダー */}
      <header className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
          <span className="text-xs text-ink-500">{post.platforms.map((p) => PLATFORM_LABEL[p]).join(" + ")}</span>
          <span className="text-xs text-ink-500">・ 依頼 {formatDateTime(post.requestedAt)}</span>
        </div>
        <h1 className="mt-2 text-xl font-bold text-ink-900">{post.slides[0]?.headline || article?.title || "SNS 投稿"}</h1>
        <p className="mt-1 text-sm text-ink-700">
          記事:{" "}
          {article ? (
            <a href={`/articles/${article.slug}`} target="_blank" rel="noreferrer" className="text-pomie-600 hover:underline">
              {article.title} ↗
            </a>
          ) : (
            <span className="text-red-700">記事が見つかりません（削除された可能性があります）</span>
          )}
        </p>
        {post.brief && <p className="mt-1 text-xs text-ink-700">指示: {post.brief}</p>}
        {post.photoConsent && <p className="mt-1 text-xs text-ink-700">美容師の写真: 使用可（{post.photoConsent}）</p>}
        {post.status === "requested" && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            {post.imageRequest ? (
              <>
                画像の作り直しを依頼中です: 「{post.imageRequest}」。Claude Code で <code className="rounded bg-white px-1">/make-social-post</code>{" "}
                を実行すると作り直されます。
              </>
            ) : (
              <>
                Claude Code で <code className="rounded bg-white px-1">/make-social-post</code> を実行すると、投稿文とスライド画像が作られます。
              </>
            )}
          </div>
        )}
        {post.status === "failed" && post.error && <p className="mt-3 text-xs text-red-700">失敗: {post.error}</p>}
        {post.lint && ((post.lint.errors?.length ?? 0) > 0 || (post.lint.warnings?.length ?? 0) > 0) && (
          <div className="mt-3 text-xs">
            {post.lint.errors?.map((e, i) => (
              <p key={`e${i}`} className="text-red-700">
                ✗ {e}
              </p>
            ))}
            {post.lint.warnings?.map((w, i) => (
              <p key={`w${i}`} className="text-ink-500">
                ・{w}
              </p>
            ))}
          </div>
        )}
        {message && <p className="mt-3 rounded-lg bg-pomie-50 px-3 py-2 text-xs text-pomie-700">{message}</p>}
      </header>

      {hasContent && editable && (
        <>
          {/* スライド */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-ink-900">スライド（{slides.length} 枚・1080×1350）</h2>
              <label className="flex items-center gap-2 text-xs text-ink-700">
                見た目
                <select
                  className="input w-auto py-1 text-xs"
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value as SocialTemplate);
                    touch();
                  }}
                >
                  {SOCIAL_TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {TEMPLATE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              プレビューは保存した内容で描かれます。文字を直したら「保存」で反映。画像の無いスライドは自動でクリーム地になります。
            </p>
            <div className="mt-4 space-y-5">
              {slides.map((s, i) => (
                <div key={i} className="grid gap-4 border-t border-ink-100 pt-4 md:grid-cols-[220px_1fr]">
                  <div>
                    {post.slides[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewSrc(i)} alt={`スライド ${i + 1}`} width={220} height={275} className="w-[220px] rounded-lg bg-ink-100 shadow-sm" />
                    ) : (
                      <div className="flex h-[275px] w-[220px] items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-500">保存するとプレビュー</div>
                    )}
                    <div className="mt-2 flex gap-2 text-[11px]">
                      <button type="button" onClick={() => moveSlide(i, -1)} disabled={i === 0} className="text-pomie-600 hover:underline disabled:text-ink-300">
                        ↑ 前へ
                      </button>
                      <button type="button" onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1} className="text-pomie-600 hover:underline disabled:text-ink-300">
                        ↓ 後へ
                      </button>
                      <button type="button" onClick={() => removeSlide(i)} className="text-red-700 hover:underline">
                        削除
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-900">{i + 1} 枚目</span>
                      <select className="input w-auto py-1 text-xs" value={s.kind} onChange={(e) => updateSlide(i, { kind: e.target.value as SocialSlideKind })}>
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {SLIDE_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input w-auto py-1 text-xs"
                        value={s.template ?? ""}
                        onChange={(e) => updateSlide(i, { template: (e.target.value || null) as SocialTemplate | null })}
                      >
                        <option value="">見た目: 投稿の設定に従う</option>
                        {SOCIAL_TEMPLATES.map((t) => (
                          <option key={t} value={t}>
                            見た目: {TEMPLATE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input className="input" placeholder="見出し（28 文字まで目安）" value={s.headline} onChange={(e) => updateSlide(i, { headline: e.target.value })} />
                    <textarea className="input min-h-[60px]" placeholder="本文（70 文字まで目安。無くても可）" value={s.body} onChange={(e) => updateSlide(i, { body: e.target.value })} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ink-500">背景画像:</span>
                      {(
                        [
                          ["none", "なし"],
                          ["ai", "AI 生成"],
                          ["store", "店舗写真"],
                          ["upload", "アップロード"],
                        ] as Array<[SocialImageSource, string]>
                      ).map(([v, label]) => (
                        <label key={v} className="flex items-center gap-1">
                          <input
                            type="radio"
                            name={`src-${i}`}
                            checked={s.imageSource === v}
                            onChange={() => updateSlide(i, { imageSource: v, ...(v === "none" ? { imageUrl: null } : {}) })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {s.imageSource === "ai" && (
                      <div className="rounded-lg bg-pomie-50 p-2">
                        <p className="text-ink-700">
                          {s.imageUrl ? "AI で生成した画像を使っています。" : "まだ画像がありません。"}
                          作り直したいときは、このページの下の「画像の作り直しを依頼」から。
                        </p>
                        <textarea
                          className="input mt-1 min-h-[48px] text-[11px]"
                          placeholder="画像の指示（AI 用）"
                          value={s.imagePrompt ?? ""}
                          onChange={(e) => updateSlide(i, { imagePrompt: e.target.value })}
                        />
                      </div>
                    )}
                    {s.imageSource === "store" && (
                      <div className="flex flex-wrap gap-2">
                        {storePhotos.map((p) => (
                          <button
                            key={p.url}
                            type="button"
                            title={p.label}
                            onClick={() => updateSlide(i, { imageUrl: p.url })}
                            className={`overflow-hidden rounded-md ring-2 ${s.imageUrl === p.url ? "ring-pomie-500" : "ring-transparent hover:ring-pomie-200"}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.label} className="h-14 w-14 object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    {s.imageSource === "upload" && (
                      <ImageUploadField value={s.imageUrl ?? ""} onChange={(url) => updateSlide(i, { imageUrl: url })} folder="social" ownerKey={`${post.id}-${i + 1}`} previewShape="square" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={addSlide} disabled={slides.length >= MAX_SLIDES} className="btn-secondary px-4 py-1.5 text-xs disabled:opacity-50">
                + スライドを追加
              </button>
            </div>
          </section>

          {/* 投稿文 */}
          <section className="card p-5">
            <h2 className="font-semibold text-ink-900">投稿文</h2>
            <div className="mt-3 grid gap-5 md:grid-cols-2">
              {post.platforms.includes("instagram") && (
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-ink-700">Instagram</p>
                  <textarea
                    className="input min-h-[220px]"
                    value={caption}
                    onChange={(e) => {
                      setCaption(e.target.value);
                      touch();
                    }}
                  />
                  <p className="text-ink-500">
                    {caption.length} 文字 ・ リンクは押せないので「プロフィールのリンクから」と案内（プロフィールのリンク先はポータルのトップ）
                  </p>
                  <textarea
                    className="input min-h-[80px]"
                    placeholder="#ハッシュタグ（スペース区切り）"
                    value={hashtagsText}
                    onChange={(e) => {
                      setHashtagsText(e.target.value);
                      touch();
                    }}
                  />
                  <p className={hashtags.length > HASHTAG_MAX ? "text-red-700" : "text-ink-500"}>
                    ハッシュタグ {hashtags.length} 個（{HASHTAG_RECOMMENDED.min}〜{HASHTAG_RECOMMENDED.max} 個が目安、上限 {HASHTAG_MAX}）
                    {missingTags.length > 0 && <span className="text-amber-800"> ・ 足りない基本タグ: {missingTags.map((t) => `#${t}`).join(" ")}</span>}
                  </p>
                  <input
                    className="input"
                    placeholder="画像の代替テキスト（alt）"
                    value={altText}
                    onChange={(e) => {
                      setAltText(e.target.value);
                      touch();
                    }}
                  />
                  <button type="button" onClick={() => copy(instagramCaptionFull({ caption, hashtags }), "Instagram の本文")} className="btn-secondary px-4 py-1.5 text-xs">
                    本文＋ハッシュタグをコピー
                  </button>
                </div>
              )}
              {post.platforms.includes("x") && (
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-ink-700">X</p>
                  <textarea
                    className="input min-h-[120px]"
                    value={xText}
                    onChange={(e) => {
                      setXText(e.target.value);
                      touch();
                    }}
                  />
                  <p className={xLen > X_WEIGHT_LIMIT ? "text-red-700" : "text-ink-500"}>
                    本文: 日本語換算 {Math.ceil(xLen / 2)} / {X_WEIGHT_LIMIT / 2} 文字 ・ 画像は 1 枚目のスライドを添付
                  </p>
                  <textarea
                    className="input min-h-[80px]"
                    placeholder="返信（記事へのリンクを載せる）"
                    value={xReply}
                    onChange={(e) => {
                      setXReply(e.target.value);
                      touch();
                    }}
                  />
                  <p className={xReplyLen > X_WEIGHT_LIMIT ? "text-red-700" : "text-ink-500"}>返信: 日本語換算 {Math.ceil(xReplyLen / 2)} / {X_WEIGHT_LIMIT / 2} 文字</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => copy(xText, "X の本文")} className="btn-secondary px-4 py-1.5 text-xs">
                      本文をコピー
                    </button>
                    <button type="button" onClick={() => copy(xReply, "X の返信")} className="btn-secondary px-4 py-1.5 text-xs">
                      返信をコピー
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={save} disabled={pending} className="btn-primary px-5 py-2 text-xs disabled:opacity-50">
                {pending ? "処理中…" : "保存"}
              </button>
              {dirty && <span className="text-xs text-amber-800">保存していない変更があります</span>}
            </div>
          </section>

          {/* 書き出し */}
          <section className="card p-5">
            <h2 className="font-semibold text-ink-900">書き出し（投稿用の画像）</h2>
            <p className="mt-1 text-xs text-ink-500">文字を合成した最終画像（PNG）を作ります。文字や画像を変えたら、もう一度書き出してください。</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={exportImages} disabled={pending} className="btn-primary px-5 py-2 text-xs disabled:opacity-50">
                {pending ? "処理中…" : post.renderedUrls.length ? "もう一度書き出す" : "書き出す"}
              </button>
              {post.renderedUrls.length > 0 && (
                <>
                  <button type="button" onClick={downloadAll} disabled={downloading} className="btn-secondary px-5 py-2 text-xs disabled:opacity-50">
                    {downloading ? "ダウンロード中…" : `すべてダウンロード（${post.renderedUrls.length} 枚）`}
                  </button>
                  <span className="text-xs text-ink-500">書き出し {post.renderedAt ? formatDateTime(post.renderedAt) : ""}</span>
                </>
              )}
            </div>
            {post.renderedUrls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {post.renderedUrls.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-center text-[11px] text-pomie-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`書き出し ${i + 1}`} className="w-[140px] rounded-md shadow-sm" />
                    {i + 1} 枚目を開く ↗
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* 投稿の記録 */}
          <section className="card p-5">
            <h2 className="font-semibold text-ink-900">投稿の記録</h2>
            <p className="mt-1 text-xs text-ink-500">投稿したら媒体ごとに「投稿済みにする」。投稿の URL を控えておくと、あとで見返せます。</p>
            <div className="mt-3 space-y-2 text-xs">
              {post.platforms.map((p) => {
                const done = post.posted[p];
                return (
                  <div key={p} className="flex flex-wrap items-center gap-2">
                    <span className="w-20 font-semibold text-ink-700">{PLATFORM_LABEL[p]}</span>
                    {done ? (
                      <>
                        <span className="text-green-800">投稿済み {formatDateTime(done.at)}</span>
                        {done.url && (
                          <a href={done.url} target="_blank" rel="noreferrer" className="text-pomie-600 hover:underline">
                            開く ↗
                          </a>
                        )}
                        <button type="button" onClick={() => run(() => clearPosted(post.id, p), "取り消しました")} className="text-ink-500 hover:underline">
                          取り消す
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          className="input w-72"
                          placeholder="投稿の URL（任意）"
                          value={postUrls[p] ?? ""}
                          onChange={(e) => setPostUrls((cur) => ({ ...cur, [p]: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() => run(() => markPosted(post.id, p, postUrls[p] ?? ""), `${PLATFORM_LABEL[p]} を投稿済みにしました`)}
                          disabled={pending}
                          className="btn-secondary px-4 py-1.5 text-xs disabled:opacity-50"
                        >
                          投稿済みにする
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 画像の作り直し */}
          {post.status !== "posted" && (
            <section className="card p-5">
              <h2 className="font-semibold text-ink-900">画像の作り直しを依頼</h2>
              <p className="mt-1 text-xs text-ink-500">AI 生成の画像を作り直してほしいときに。指示を書いて依頼すると、Claude Code の /make-social-post が作り直します。</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input className="input w-96" placeholder="例: もっと明るい雰囲気に / 2 枚目は髪のアップに" value={imageNote} onChange={(e) => setImageNote(e.target.value)} />
                <button
                  type="button"
                  onClick={() => run(() => requestImageRegeneration(post.id, imageNote), "画像の作り直しを依頼しました", () => setImageNote(""))}
                  disabled={pending}
                  className="btn-secondary px-4 py-1.5 text-xs disabled:opacity-50"
                >
                  依頼する
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* 却下・削除 */}
      <section className="flex flex-wrap gap-3 text-xs">
        {post.status !== "posted" && post.status !== "rejected" && (
          <button
            type="button"
            onClick={() => window.confirm("この投稿を却下しますか？（あとで削除できます）") && run(() => rejectSocialPost(post.id), "却下しました")}
            className="text-ink-500 hover:underline"
          >
            却下する
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            window.confirm("この投稿と画像を削除しますか？この操作は取り消せません") &&
            run(
              () => deleteSocialPost(post.id),
              "削除しました",
              () => router.push("/admin/social")
            )
          }
          className="text-red-700 hover:underline"
        >
          削除する
        </button>
        <Link href="/admin/social" className="text-pomie-600 hover:underline">
          一覧へ
        </Link>
      </section>
    </div>
  );
}
