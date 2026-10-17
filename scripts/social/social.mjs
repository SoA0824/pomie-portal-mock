/**
 * SNS 投稿（コネクタ経路 = Claude Code の /make-social-post から使う）。
 *
 *   node scripts/social/social.mjs list
 *       … 作成待ち（依頼済み）の一覧
 *   node scripts/social/social.mjs request --article <slug|id> [--platforms instagram,x] [--brief "..."]
 *       … チャットから依頼する（管理画面からの依頼と同じ扱い）
 *   node scripts/social/social.mjs context <投稿ID> [--out ディレクトリ]
 *       … 材料（記事・美容師・店舗・ルール）を JSON で出し、企画ファイル content/social/<投稿ID>.json を用意する
 *   node scripts/social/social.mjs save <投稿ID> --file content/social/<投稿ID>.json [--no-images] [--regenerate] [--provider gemini|openai]
 *       … 検品して「下書き」として保存し、AI 画像を生成する（管理画面で確認 → 書き出し → 投稿）
 *   node scripts/social/social.mjs images <投稿ID> [--slide 1] [--force] [--provider gemini|openai] [--ref store]
 *       … AI 画像だけ作る（作り直し）
 *   node scripts/social/social.mjs fail <投稿ID> --reason "..."
 *
 * 共通: --target production|mock
 */
import fs from "node:fs";
import path from "node:path";
import { fetchLintContext, loadDb, newId, parseArgs, rest } from "../articles/lib.mjs";
import {
  DEFAULT_PLATFORMS,
  HASHTAG_RECOMMENDED,
  INSTAGRAM_CAPTION_RECOMMENDED,
  PLANS_DIR,
  SITE_URL,
  SLIDE_LIMITS,
  THREADS_TEXT_RECOMMENDED,
  X_WEIGHT_LIMIT,
  absoluteUrl,
  adminUrl,
  areaNames,
  articleUrlFor,
  articleUrlForX,
  getArticle,
  getPost,
  lintPlan,
  normalizePlan,
  patchPost,
  printLint,
  readJson,
  requiredHashtags,
  storePhotos,
  uploadImage,
} from "./lib.mjs";
import { PROMPT_SUFFIX, generateImage, modelFor, pickProvider } from "./providers.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

function platformLabel(p) {
  return p === "instagram" ? "Instagram" : p === "threads" ? "Threads" : p === "x" ? "X" : p;
}

/** 企画ファイルの雛形（まだ中身が無い投稿用） */
function skeletonPlan(article, post) {
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
function planFromPost(post) {
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
async function generateImages(db, post, { only, force, provider: providerArg, ref }) {
  const slides = post.slides ?? [];
  const targets = slides.map((s, i) => ({ s, i })).filter(({ s, i }) => s.image_source === "ai" && (only === undefined || only === i) && (force || !s.image_url));
  if (!targets.length) {
    console.log("生成する AI 画像はありません（すでに画像があるスライドは --force で作り直せます）");
    return post;
  }
  const provider = pickProvider(providerArg);
  const article = await getArticle(db, post.article_id);
  const refs = ref === "store" ? [absoluteUrl(storePhotos(article.areas)[0]?.photos[0])].filter(Boolean) : [];
  console.log(`画像 API: ${provider}（${modelFor(provider)}）${refs.length ? " / 参照: 店舗写真" : ""}`);
  const raw = [...(post.raw_image_urls ?? [])];
  let model = null;
  for (const { s, i } of targets) {
    if (!s.image_prompt) {
      console.log(`  スライド ${i + 1}: 画像の指示（image.prompt）が無いので飛ばします`);
      continue;
    }
    process.stdout.write(`  スライド ${i + 1}: 生成中…`);
    const t0 = Date.now();
    const img = await generateImage({ provider, prompt: s.image_prompt, aspectRatio: "4:5", referenceImageUrls: refs });
    const ext = img.mime.includes("jpeg") ? "jpg" : img.mime.includes("webp") ? "webp" : "png";
    const objectPath = `social/${post.id}/raw-${String(i + 1).padStart(2, "0")}-${Date.now().toString(36)}.${ext}`;
    const url = await uploadImage(db, objectPath, img.bytes, img.mime);
    slides[i] = { ...s, image_url: url };
    raw.push(url);
    model = img.model;
    console.log(` 完了（${Math.round((Date.now() - t0) / 1000)} 秒・${Math.round(img.bytes.length / 1024)}KB）`);
    await patchPost(db, post.id, { slides, raw_image_urls: raw, image_provider: provider, image_model: model });
  }
  return { ...post, slides, raw_image_urls: raw };
}

async function main() {
  const db = loadDb(args.target ?? "production");

  if (cmd === "list") {
    const posts = await rest(db, "GET", "social_posts?select=*&status=eq.requested&order=requested_at");
    if (!posts.length) {
      console.log("作成待ちの SNS 投稿はありません");
      return;
    }
    for (const p of posts) {
      const a = await getArticle(db, p.article_id).catch(() => null);
      console.log(`${p.id}  ${a ? a.title : "(記事なし)"}  /articles/${a?.slug ?? "-"}  [${(p.platforms ?? []).map(platformLabel).join(" + ")}]`);
      if (p.brief) console.log(`    指示: ${p.brief.replace(/\n/g, " / ")}`);
      if (p.image_request) console.log(`    画像の作り直し: ${p.image_request}`);
      if ((p.slides ?? []).length) console.log(`    （すでに ${p.slides.length} 枚のスライドあり → 作り直しモード）`);
    }
    return;
  }

  if (cmd === "request") {
    if (typeof args.article !== "string") throw new Error("--article に記事の slug か ID を指定してください");
    const article = await getArticle(db, args.article);
    if (article.status !== "published") throw new Error("公開中の記事だけ SNS 投稿を作れます（先に記事を公開してください）");
    const platforms = typeof args.platforms === "string" ? args.platforms.split(",").map((s) => s.trim()).filter((s) => DEFAULT_PLATFORMS.includes(s)) : DEFAULT_PLATFORMS;
    if (!platforms.length) throw new Error("--platforms は instagram,threads,x のいずれかを指定してください");
    const id = newId("sp");
    await rest(db, "POST", "social_posts", {
      body: {
        id,
        article_id: article.id,
        platforms,
        status: "requested",
        brief: typeof args.brief === "string" ? args.brief : "",
      },
      prefer: "return=minimal",
    });
    console.log(`SNS 投稿を依頼しました: ${id}（${article.title} / ${platforms.map(platformLabel).join(" + ")}）`);
    return;
  }

  if (cmd === "context") {
    const post = await getPost(db, args._[1] ?? "");
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
        instagram: "本文に URL は書かない（押せない）。『詳しくはプロフィールのリンクから』と案内する。プロフィールのリンク先はポータルのトップ",
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
        slides: `4〜5 枚（cover → point × 2〜3 → cta）。見出し ${SLIDE_LIMITS.headline} 文字以内、本文 ${SLIDE_LIMITS.body} 文字以内。記事の見出し・主張から作り、新しい主張や数字を足さない`,
        images: "AI 画像は表紙など 1〜2 枚まで。雰囲気（サロンの空間、髪の質感の寄り、小物、光）だけを描き、人の顔・施術例・ビフォーアフター風・文字は描かない。他のスライドは画像なし（クリーム地）か店舗写真",
        x: `本文は日本語換算 ${X_WEIGHT_LIMIT / 2} 文字まで。URL は入れない。最後に『詳しくは返信のリンクから』`,
        threads: `${THREADS_TEXT_RECOMMENDED} 文字以内が目安（上限 500）。X より少し詳しく、要点 2〜3 つ＋最後に記事 URL。画像はスライドが全部付く`,
        facts: "料金・メニューなどの事実は記事にあるものだけ。発言・お客様の声・施術例を創作しない。断定できないことは書かないか [要確認: …]",
        promptSuffix: `画像の指示には自動で次が付く: ${PROMPT_SUFFIX}`,
      },
    };

    const outDir = typeof args.out === "string" ? args.out : "/tmp";
    fs.mkdirSync(outDir, { recursive: true });
    const jsonFile = path.join(outDir, `pomie-social-${post.id}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(out, null, 2));
    fs.mkdirSync(PLANS_DIR, { recursive: true });
    const planFile = path.join(PLANS_DIR, `${post.id}.json`);
    fs.writeFileSync(planFile, JSON.stringify(regenerate ? planFromPost(post) : skeletonPlan(article, post), null, 2));

    console.log(`材料: ${jsonFile}`);
    console.log(`企画ファイル: ${path.relative(process.cwd(), planFile)}（${regenerate ? "今の内容。必要な箇所だけ直す" : "雛形。埋めて save する"}）`);
    console.log(`\n記事: ${article.title}（/articles/${article.slug}）`);
    console.log(`媒体: ${platforms.map(platformLabel).join(" + ")} / エリア: ${areaNames(article.areas ?? []).join("・") || "なし"}`);
    if (post.brief) console.log(`指示: ${post.brief}`);
    if (post.image_request) console.log(`画像の作り直し: ${post.image_request}`);
    if (out.article.stylistNamesNotToUse.length) console.log(`投稿に書かない名前（記事本文に出てくる美容師）: ${out.article.stylistNamesNotToUse.join("、")}`);
    console.log(`必須ハッシュタグ: ${out.hashtags.required.map((t) => `#${t}`).join(" ")}`);
    return;
  }

  if (cmd === "save") {
    const post = await getPost(db, args._[1] ?? "");
    if (post.status === "posted") throw new Error("投稿済みの投稿は上書きできません");
    if (typeof args.file !== "string") throw new Error("--file に企画ファイル（JSON）を指定してください");
    const article = await getArticle(db, post.article_id);
    const lintCtx = await fetchLintContext(db);
    const plan = normalizePlan(readJson(args.file), { article, post });
    const lint = lintPlan(plan, { article, post, lintCtx });
    console.log(`検品: ${args.file}`);
    printLint(lint);
    if (lint.errors.length) {
      console.log(`\nエラー ${lint.errors.length} 件のため保存しませんでした。`);
      process.exit(1);
    }
    // 作り直しのときは、今ある AI 画像を引き継ぐ（指示が同じなら作り直さない）
    const prev = post.slides ?? [];
    const slides = plan.slides.map((s, i) => {
      const old = prev[i];
      if (s.image_source === "ai" && !s.image_url && old && old.image_source === "ai" && old.image_url && old.image_prompt === s.image_prompt && !args.regenerate) {
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
      lint: { errors: [], warnings: lint.warnings },
      image_request: null,
      error: null,
      generation_log: { savedAt: new Date().toISOString(), source: "claude-code", regenerate: Boolean(args.regenerate) },
    });
    console.log(`\n下書きとして保存しました: ${article.title}`);
    if (!args["no-images"]) {
      try {
        await generateImages(db, { ...post, slides, status: "draft" }, { force: Boolean(args.regenerate), provider: typeof args.provider === "string" ? args.provider : undefined, ref: args.ref });
      } catch (err) {
        await patchPost(db, post.id, { error: `画像の生成に失敗: ${err.message}` });
        console.log(`\n画像の生成に失敗しました: ${err.message}`);
        console.log("  文字の下書きは保存されています。管理画面で店舗写真に切り替えるか、原因を直して `images` で作り直せます。");
        process.exitCode = 1;
      }
    }
    console.log(`\n確認・書き出し: ${adminUrl(post.id)}`);
    return;
  }

  if (cmd === "images") {
    const post = await getPost(db, args._[1] ?? "");
    const only = args.slide !== undefined ? Number(args.slide) - 1 : undefined;
    if (only !== undefined && (!Number.isInteger(only) || only < 0)) throw new Error("--slide は 1 から始まる番号で指定してください");
    await generateImages(db, post, { only, force: Boolean(args.force), provider: typeof args.provider === "string" ? args.provider : undefined, ref: args.ref });
    if (post.status === "requested") await patchPost(db, post.id, { status: "draft", image_request: null, error: null });
    console.log(`\n確認・書き出し: ${adminUrl(post.id)}`);
    return;
  }

  if (cmd === "fail") {
    const post = await getPost(db, args._[1] ?? "");
    await patchPost(db, post.id, { status: "failed", error: typeof args.reason === "string" ? args.reason : "作成に失敗しました" });
    console.log("失敗として記録しました");
    return;
  }

  console.log("使い方は scripts/social/social.mjs の先頭を参照してください（list / request / context / save / images / fail）");
  process.exit(2);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});

