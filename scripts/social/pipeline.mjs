/**
 * SNS 投稿の共通処理（材料づくり・企画の保存・画像生成）。
 * social.mjs（Claude Code からの CLI）と scripts/jobs/handlers.mjs（API 実行）の両方から使う。
 */
import { fetchLintContext } from "../articles/lib.mjs";
import {
  DEFAULT_PLATFORMS,
  HASHTAG_RECOMMENDED,
  INSTAGRAM_CAPTION_RECOMMENDED,
  SITE_URL,
  SLIDE_LIMITS,
  THREADS_TEXT_RECOMMENDED,
  X_WEIGHT_LIMIT,
  absoluteUrl,
  areaNames,
  articleUrlFor,
  articleUrlForX,
  getArticle,
  lintPlan,
  normalizePlan,
  patchPost,
  requiredHashtags,
  storePhotos,
  uploadImage,
} from "./lib.mjs";
import { PROMPT_SUFFIX, generateImage, modelFor, pickProvider } from "./providers.mjs";

export function platformLabel(p) {
  return p === "instagram" ? "Instagram" : p === "threads" ? "Threads" : p === "x" ? "X" : p;
}

/** 企画ファイルの雛形（まだ中身が無い投稿用） */
export function skeletonPlan(article, post) {
  const platforms = post.platforms ?? DEFAULT_PLATFORMS;
  return {
    caption: platforms.includes("instagram") ? "" : undefined,
    hashtags: requiredHashtags(article.areas ?? []),
    alt_text: "",
    x_text: platforms.includes("x") ? "" : undefined,
    x_reply: platforms.includes("x") ? "" : undefined,
    threads_text: platforms.includes("threads") ? "" : undefined,
    template: "photo",
    slides: [
      { kind: "cover", headline: "", body: "", image: { source: "ai", prompt: "" } },
      { kind: "point", headline: "", body: "", image: { source: "none" } },
      { kind: "point", headline: "", body: "", image: { source: "none" } },
      { kind: "point", headline: "", body: "", image: { source: "none" } },
      { kind: "cta", headline: "続きはプロフィールのリンクから", body: "", image: { source: "none" } },
    ],
  };
}

/** DB の投稿を企画ファイルの形に戻す（作り直し用） */
export function planFromPost(post) {
  return {
    caption: post.caption ?? "",
    hashtags: post.hashtags ?? [],
    alt_text: post.alt_text ?? "",
    x_text: post.x_text ?? "",
    x_reply: post.x_reply ?? "",
    threads_text: post.threads_text ?? "",
    template: post.template ?? "photo",
    slides: (post.slides ?? []).map((s) => ({
      kind: s.kind,
      headline: s.headline,
      body: s.body,
      template: s.template ?? undefined,
      image: { source: s.image_source ?? "none", prompt: s.image_prompt ?? undefined, url: s.image_url ?? undefined },
    })),
  };
}

/** AI 画像を作って Storage に保存し、スライドに反映する */
export async function generateImages(db, post, { only, force, provider: providerArg, ref, log = console.log } = {}) {
  const slides = post.slides ?? [];
  const targets = slides.map((s, i) => ({ s, i })).filter(({ s, i }) => s.image_source === "ai" && (only === undefined || only === i) && (force || !s.image_url));
  if (!targets.length) {
    log("生成する AI 画像はありません（すでに画像があるスライドは --force で作り直せます）");
    return { post, generated: 0 };
  }
  const provider = pickProvider(providerArg);
  const article = await getArticle(db, post.article_id);
  const refs = ref === "store" ? [absoluteUrl(storePhotos(article.areas)[0]?.photos[0])].filter(Boolean) : [];
  log(`画像 API: ${provider}（${modelFor(provider)}）${refs.length ? " / 参照: 店舗写真" : ""}`);
  const raw = [...(post.raw_image_urls ?? [])];
  let model = null;
  let generated = 0;
  for (const { s, i } of targets) {
    if (!s.image_prompt) {
      log(`  スライド ${i + 1}: 画像の指示（image.prompt）が無いので飛ばします`);
      continue;
    }
    const t0 = Date.now();
    const img = await generateImage({ provider, prompt: s.image_prompt, aspectRatio: "4:5", referenceImageUrls: refs });
    const ext = img.mime.includes("jpeg") ? "jpg" : img.mime.includes("webp") ? "webp" : "png";
    const objectPath = `social/${post.id}/raw-${String(i + 1).padStart(2, "0")}-${Date.now().toString(36)}.${ext}`;
    const url = await uploadImage(db, objectPath, img.bytes, img.mime);
    slides[i] = { ...s, image_url: url };
    raw.push(url);
    model = img.model;
    generated++;
    log(`  スライド ${i + 1}: 生成 完了（${Math.round((Date.now() - t0) / 1000)} 秒・${Math.round(img.bytes.length / 1024)}KB）`);
    await patchPost(db, post.id, { slides, raw_image_urls: raw, image_provider: provider, image_model: model });
  }
  return { post: { ...post, slides, raw_image_urls: raw }, generated };
}

/** 材料（記事・店舗・ハッシュタグ・ルール）。regenerate のときは今の企画も入る */
export async function buildSocialContext(db, post) {
  const article = await getArticle(db, post.article_id);
  const lintCtx = await fetchLintContext(db);
  const stylistNames = [...lintCtx.stylists.values()].map((s) => s.name).filter(Boolean);
  const platforms = post.platforms ?? DEFAULT_PLATFORMS;
  const regenerate = (post.slides ?? []).length > 0;
  const stores = storePhotos(article.areas).map((s) => ({ ...s, photos: s.photos.map((p) => ({ path: p, url: absoluteUrl(p) })) }));
  const out = {
    post: {
      id: post.id,
      platforms,
      format: post.format,
      brief: post.brief ?? "",
      imageRequest: post.image_request ?? null,
      mode: regenerate ? "regenerate（既存の企画を直す。文字は必要な箇所だけ変える）" : "new",
      existingPlan: regenerate ? planFromPost(post) : null,
    },
    article: {
      id: article.id,
      slug: article.slug,
      url: `${SITE_URL}/articles/${article.slug}`,
      title: article.title,
      summary: article.summary,
      category: article.category,
      targetKeyword: article.target_keyword,
      areas: article.areas ?? [],
      areaNames: areaNames(article.areas ?? []),
      body: article.body,
      // 記事本文に出てくる美容師の名前。投稿には書かない（検品でエラーになる）
      stylistNamesNotToUse: stylistNames.filter((n) => (article.body ?? "").includes(n)),
    },
    stores,
    hashtags: {
      required: requiredHashtags(article.areas ?? []),
      recommendedTotal: HASHTAG_RECOMMENDED,
      hint: "必須タグに加えて、記事に合うテーマのタグ（エリア×美容室、メニュー、悩み、年代など）を足して合計 10〜15 個",
    },
    links: {
      instagram: "本文に URL は書かない（押せない）。『詳しくはプロフィールのリンクから』と案内する。プロフィールのリンク先はポータルのトップ（一番上に新着記事が並ぶ）",
      xReplyUrl: platforms.includes("x") ? articleUrlForX(article.slug) : null,
      xHint: "X は本文に URL を入れず、返信（x_reply）に記事の URL を載せる（URL が無ければ保存時に自動で付く）",
      threadsUrl: platforms.includes("threads") ? articleUrlFor(article.slug, "threads") : null,
      threadsHint: "Threads は本文のリンクが押せる。threads_text の最後に記事 URL を置く（無ければ保存時に自動で付く）",
    },
    rules: {
      tone: "読みやすく、固すぎない。です・ます調をベースに、話しかけるように。Instagram の本文は絵文字 2〜4 個まで、X は 0〜1 個、スライドの文字には絵文字を使わない",
      audience: "記事の読者（お客さま）に向けて書く。固定タグ（#シェアサロン など）は美容師の採用にもつなげるためのもので、本文を採用向けにはしない",
      instagramCaption: `${INSTAGRAM_CAPTION_RECOMMENDED.min}〜${INSTAGRAM_CAPTION_RECOMMENDED.max} 文字。冒頭 1 行で内容が分かるように（折りたたまれる）。最後に記事への導線`,
      stylists: "美容師の名前・プロフィール・写真・リンクは本文にもスライドにも入れない（投稿はポータルの記事紹介。美容師は記事の中で紹介される）。店舗名も基本は書かない（エリア名は可）",
      slides: `4〜5 枚（cover → point × 2〜3 → cta）。見出し ${SLIDE_LIMITS.headline} 文字以内、本文 ${SLIDE_LIMITS.body} 文字以内。見出しが 13 文字を超えるときは区切りのよい位置に改行（\\n）を入れる。記事の見出し・主張から作り、新しい主張や数字を足さない`,
      images: "AI 画像は表紙など 1〜2 枚まで。雰囲気（サロンの空間、髪の質感の寄り、小物、光）だけを描き、人の顔・施術例・ビフォーアフター風・文字は描かない。実在の店舗でなくてよい。他のスライドは画像なし（クリーム地）か店舗写真",
      x: `本文は日本語換算 ${X_WEIGHT_LIMIT / 2} 文字まで。URL は入れない。最後に『詳しくは返信のリンクから』`,
      threads: `${THREADS_TEXT_RECOMMENDED} 文字以内が目安（上限 500）。X より少し詳しく、要点 2〜3 つ＋最後に記事 URL。画像はスライドが全部付く`,
      facts: "料金・メニューなどの事実は記事にあるものだけ。発言・お客様の声・施術例を創作しない。断定できないことは書かないか [要確認: …]",
      promptSuffix: `画像の指示には自動で次が付く: ${PROMPT_SUFFIX}`,
    },
  };
  return { out, article, regenerate, plan: regenerate ? planFromPost(post) : skeletonPlan(article, post), lintCtx };
}

/**
 * 企画を検品して「下書き」として保存し、AI 画像を作る。
 * 検品エラーがあれば保存せず { ok: false, lint } を返す。
 */
export async function savePlan(db, post, article, rawPlan, { regenerate = false, noImages = false, provider, ref, log = console.log, lintCtx } = {}) {
  const ctx = lintCtx ?? (await fetchLintContext(db));
  const plan = normalizePlan(rawPlan, { article, post });
  const lint = lintPlan(plan, { article, post, lintCtx: ctx });
  if (lint.errors.length) return { ok: false, lint, plan };

  // 作り直しのときは、今ある AI 画像を引き継ぐ（指示が同じなら作り直さない）
  const prev = post.slides ?? [];
  const slides = plan.slides.map((s, i) => {
    const old = prev[i];
    if (s.image_source === "ai" && !s.image_url && old && old.image_source === "ai" && old.image_url && old.image_prompt === s.image_prompt && !regenerate) {
      return { ...s, image_url: old.image_url };
    }
    return s;
  });
  await patchPost(db, post.id, {
    status: "draft",
    caption: plan.caption || null,
    hashtags: plan.hashtags,
    alt_text: plan.alt_text || null,
    x_text: plan.x_text || null,
    x_reply: plan.x_reply || null,
    threads_text: plan.threads_text || null,
    template: plan.template,
    slides,
    lint: { errors: [], warnings: lint.warnings.map((w) => w) },
    image_request: null,
    error: null,
    generation_log: { ...(post.generation_log && typeof post.generation_log === "object" ? post.generation_log : {}), savedAt: new Date().toISOString(), regenerate },
  });
  log(`下書きとして保存しました: ${article.title}`);
  let imageError = null;
  let generated = 0;
  if (!noImages) {
    try {
      const r = await generateImages(db, { ...post, slides, status: "draft" }, { force: regenerate, provider, ref, log });
      generated = r.generated;
    } catch (err) {
      imageError = err.message;
      await patchPost(db, post.id, { error: `画像の生成に失敗: ${err.message}` });
      log(`画像の生成に失敗しました: ${err.message}`);
      log("  文字の下書きは保存されています。管理画面で店舗写真に切り替えるか、原因を直して images で作り直せます。");
    }
  }
  return { ok: true, lint, plan, slides, generated, imageError };
}
