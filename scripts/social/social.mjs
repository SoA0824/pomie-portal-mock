/**
 * SNS 投稿（コネクタ経路 = Claude Code の /make-social-post から使う）。
 *
 *   node scripts/social/social.mjs list
 *       … 作成待ち（依頼済み）の一覧
 *   node scripts/social/social.mjs request --article <slug|id> [--platforms instagram,threads,x] [--brief "..."]
 *       … チャットから依頼する（管理画面からの依頼と同じ扱い）
 *   node scripts/social/social.mjs context <投稿ID> [--out ディレクトリ]
 *       … 材料（記事・店舗・ルール）を JSON で出し、企画ファイル content/social/<投稿ID>.json を用意する
 *   node scripts/social/social.mjs save <投稿ID> --file content/social/<投稿ID>.json [--no-images] [--regenerate] [--provider gemini|openai]
 *       … 検品して「下書き」として保存し、AI 画像を生成する（管理画面で確認 → 書き出し → 投稿）
 *   node scripts/social/social.mjs images <投稿ID> [--slide 1] [--force] [--provider gemini|openai] [--ref store]
 *       … AI 画像だけ作る（作り直し）
 *   node scripts/social/social.mjs fail <投稿ID> --reason "..."
 *
 * 共通: --target production|mock
 * 処理の本体は pipeline.mjs（API 実行 scripts/jobs/* と共通）。
 */
import fs from "node:fs";
import path from "node:path";
import { loadDb, newId, parseArgs, rest } from "../articles/lib.mjs";
import { DEFAULT_PLATFORMS, PLANS_DIR, adminUrl, areaNames, getArticle, getPost, patchPost, printLint, readJson } from "./lib.mjs";
import { buildSocialContext, generateImages, platformLabel, savePlan } from "./pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

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
      body: { id, article_id: article.id, platforms, status: "requested", brief: typeof args.brief === "string" ? args.brief : "" },
      prefer: "return=minimal",
    });
    console.log(`SNS 投稿を依頼しました: ${id}（${article.title} / ${platforms.map(platformLabel).join(" + ")}）`);
    return;
  }

  if (cmd === "context") {
    const post = await getPost(db, args._[1] ?? "");
    const { out, article, regenerate, plan } = await buildSocialContext(db, post);
    const outDir = typeof args.out === "string" ? args.out : "/tmp";
    fs.mkdirSync(outDir, { recursive: true });
    const jsonFile = path.join(outDir, `pomie-social-${post.id}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(out, null, 2));
    fs.mkdirSync(PLANS_DIR, { recursive: true });
    const planFile = path.join(PLANS_DIR, `${post.id}.json`);
    fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
    console.log(`材料: ${jsonFile}`);
    console.log(`企画ファイル: ${path.relative(process.cwd(), planFile)}（${regenerate ? "今の内容。必要な箇所だけ直す" : "雛形。埋めて save する"}）`);
    console.log(`\n記事: ${article.title}（/articles/${article.slug}）`);
    console.log(`媒体: ${out.post.platforms.map(platformLabel).join(" + ")} / エリア: ${areaNames(article.areas ?? []).join("・") || "なし"}`);
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
    const r = await savePlan(db, post, article, readJson(args.file), {
      regenerate: Boolean(args.regenerate),
      noImages: Boolean(args["no-images"]),
      provider: typeof args.provider === "string" ? args.provider : undefined,
      ref: args.ref,
    });
    console.log(`検品: ${args.file}`);
    printLint(r.lint);
    if (!r.ok) {
      console.log(`\nエラー ${r.lint.errors.length} 件のため保存しませんでした。`);
      process.exit(1);
    }
    if (r.imageError) process.exitCode = 1;
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
