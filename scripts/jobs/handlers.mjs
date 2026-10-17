/**
 * ジョブの種類ごとの処理（API 実行）。
 * どれも「下書き・提案を保存するだけ」で、公開や投稿はしない（人が管理画面で行う）。
 */
import { parseDraft } from "../articles/lib.mjs";
import { claudeAvailable, extractJson, generateText } from "../articles/claude.mjs";
import { loadGuidelines, rewriteFixUser, rewriterSystem, rewriterUser, socialFixUser, socialSystem, socialUser } from "../articles/prompts.mjs";
import { proposeKeywords } from "../articles/propose.mjs";
import { writeApprovedCandidates } from "../articles/write.mjs";
import { buildRewriteContext, getArticle, getRevision, patchRevision, saveRewriteProposal } from "../articles/rewriteLib.mjs";
import { getPost, patchPost } from "../social/lib.mjs";
import { buildSocialContext, generateImages, savePlan } from "../social/pipeline.mjs";

function requireClaude() {
  if (!claudeAvailable()) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません（GitHub の Secrets に追加してください。Claude Code からはスキルで代替できます）");
  }
}

const num = (v, d) => (v === undefined || v === null || v === "" ? d : Number(v));

// ---------------------------------------------------------------------------

async function propose(db, job, log) {
  requireClaude();
  const r = await proposeKeywords({
    db,
    limit: num(job.params?.limit, 8),
    maxCredits: num(job.params?.maxCredits, 30),
    maxSeeds: num(job.params?.maxSeeds, 4),
    log,
  });
  log(`提案 ${r.proposed.length} 件（除外 ${r.skippedCount} 件、消費 ${r.credits} クレジット）`);
  return { proposed: r.proposed.length, skipped: r.skippedCount, credits: r.credits, seeds: r.seeds };
}

async function write(db, job, log) {
  requireClaude();
  const r = await writeApprovedCandidates({ db, limit: num(job.params?.limit, 2), candidateId: job.target_id ?? undefined, log });
  if (r.written.length === 0 && r.failed.length > 0) throw new Error(`記事化に失敗しました: ${r.failed.map((f) => f.error ?? f.reason ?? f.id ?? "").join(" / ")}`);
  return { written: r.written.map((w) => w.id ?? w.slug ?? w), failed: r.failed.length };
}

// ---------------------------------------------------------------------------

/** 3 区切りの応答を分解する */
function parseRewriteResponse(text) {
  const pick = (name, next) => {
    const start = text.indexOf(`===${name}===`);
    if (start === -1) throw new Error(`応答に ===${name}=== がありません`);
    const from = start + name.length + 6;
    const end = next ? text.indexOf(`===${next}===`, from) : -1;
    return (end === -1 ? text.slice(from) : text.slice(from, end)).trim();
  };
  const analysis = pick("ANALYSIS", "SUMMARY");
  const summary = pick("SUMMARY", "DRAFT");
  const draft = pick("DRAFT").replace(/^```[a-z]*\s*\n|\n```\s*$/g, "");
  return { analysis, summary, draft };
}

function mockRewrite(draft) {
  return `===ANALYSIS===\n（テスト）料金の表記が古いため最新に合わせました。\n===SUMMARY===\n- 料金の目安を更新\n===DRAFT===\n${draft.replace(/\n\n/, "\n\n（テスト実行で追記した 1 文です。）\n\n")}`;
}

async function rewrite(db, job, log) {
  requireClaude();
  const rev = await getRevision(db, job.target_id);
  if (!["requested", "failed"].includes(rev.status)) throw new Error(`この依頼は状態が ${rev.status} のため実行しません`);
  const article = await getArticle(db, rev.article_id);
  const { out, draft } = await buildRewriteContext(db, rev, article);
  log(`記事: ${article.title} / 指示: ${rev.instruction || "（なし）"}`);
  if (out.analysis.issues.length) log(`気になる点: ${out.analysis.issues.join(" / ")}`);

  const system = rewriterSystem(loadGuidelines());
  const user = rewriterUser({ context: out, draft });
  const usage = { input: 0, output: 0, cacheRead: 0 };
  const add = (u) => {
    for (const k of Object.keys(usage)) usage[k] += u[k] ?? 0;
  };

  const first = await generateText({ system, user, maxTokens: 24000, mock: () => mockRewrite(draft) });
  add(first.usage);
  let parsed = parseRewriteResponse(first.text);
  let { meta, body } = parseDraft(parsed.draft);
  let saved = await saveRewriteProposal(db, rev, article, { meta, body, analysis: parsed.analysis, summary: parsed.summary });

  if (!saved.ok) {
    log(`検品でエラー ${saved.lint.errors.length} 件 → 書き直します`);
    const second = await generateText({
      system,
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: first.text },
        { role: "user", content: rewriteFixUser(saved.lint) },
      ],
      maxTokens: 24000,
      mock: () => first.text,
    });
    add(second.usage);
    try {
      parsed = parseRewriteResponse(second.text);
      ({ meta, body } = parseDraft(parsed.draft));
      saved = await saveRewriteProposal(db, rev, article, { meta, body, analysis: parsed.analysis, summary: parsed.summary });
    } catch (err) {
      log(`書き直しの結果を読めませんでした: ${err.message}`);
    }
  }
  if (!saved.ok) {
    const errors = saved.lint.errors.map((e) => e.message);
    await patchRevision(db, rev.id, { status: "failed", error: `検品エラーが残りました: ${errors.join(" / ")}` });
    throw new Error(`検品エラーが残ったため提案を保存できませんでした: ${errors.join(" / ")}`);
  }
  log(`リライト案を保存しました（承認待ち）: ${article.title}`);
  for (const w of saved.lint.warnings) log(`  注意: ${w.message}`);
  return { revisionId: rev.id, articleId: article.id, model: first.model, usage, warnings: saved.lint.warnings.length };
}

// ---------------------------------------------------------------------------

function mockSocialPlan(out) {
  const title = out.article.title;
  return {
    caption: `${title.slice(0, 20)}。\n\n${out.article.summary}\n\n詳しくはプロフィールのリンクから。`,
    hashtags: [...out.hashtags.required, "美容室", "ヘアケア", "髪の悩み"],
    alt_text: `サロンの空間を背景に「${title.slice(0, 16)}」の見出し。`,
    x_text: `${title}。詳しくは返信のリンクから。`,
    x_reply: "記事はこちら",
    threads_text: `${title}。要点をまとめました。`,
    template: "photo",
    slides: [
      { kind: "cover", headline: title.slice(0, 14) + "\n" + title.slice(14, 28), body: "記事の要点をまとめました", image: { source: "ai", prompt: "Calm hair salon interior, warm light" } },
      { kind: "point", headline: "ポイント 1", body: "記事の最初の見出しから。", image: { source: "none" } },
      { kind: "point", headline: "ポイント 2", body: "記事の次の見出しから。", image: { source: "none" } },
      { kind: "cta", headline: "続きは\nプロフィールのリンクから", body: "記事で詳しくまとめています", image: { source: "none" } },
    ],
  };
}

async function social(db, job, log) {
  requireClaude();
  const post = await getPost(db, job.target_id);
  if (!["requested", "failed", "draft"].includes(post.status)) throw new Error(`この投稿は状態が ${post.status} のため実行しません`);
  const { out, article, regenerate, lintCtx } = await buildSocialContext(db, post);
  log(`記事: ${article.title} / 媒体: ${out.post.platforms.join(" + ")}${regenerate ? " / 作り直し" : ""}`);

  const system = socialSystem(loadGuidelines());
  const user = socialUser({ context: out });
  const usage = { input: 0, output: 0, cacheRead: 0 };
  const add = (u) => {
    for (const k of Object.keys(usage)) usage[k] += u[k] ?? 0;
  };
  const first = await generateText({ system, user, maxTokens: 8000, mock: () => JSON.stringify(mockSocialPlan(out)) });
  add(first.usage);
  let saved = await savePlan(db, post, article, extractJson(first.text), { regenerate: regenerate && Boolean(post.image_request), log, lintCtx });

  if (!saved.ok) {
    log(`検品でエラー ${saved.lint.errors.length} 件 → 書き直します`);
    const second = await generateText({
      system,
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: first.text },
        { role: "user", content: socialFixUser(saved.lint) },
      ],
      maxTokens: 8000,
      mock: () => first.text,
    });
    add(second.usage);
    try {
      saved = await savePlan(db, post, article, extractJson(second.text), { regenerate: regenerate && Boolean(post.image_request), log, lintCtx });
    } catch (err) {
      log(`書き直しの結果を読めませんでした: ${err.message}`);
    }
  }
  if (!saved.ok) {
    await patchPost(db, post.id, { status: "failed", error: `検品エラーが残りました: ${saved.lint.errors.join(" / ")}` });
    throw new Error(`検品エラーが残ったため保存できませんでした: ${saved.lint.errors.join(" / ")}`);
  }
  if (saved.imageError) log(`画像は作れませんでした（文字の下書きは保存済み）: ${saved.imageError}`);
  return { postId: post.id, model: first.model, usage, images: saved.generated, warnings: saved.lint.warnings.length, imageError: saved.imageError };
}

async function socialImages(db, job, log) {
  const post = await getPost(db, job.target_id);
  if (post.status === "posted" || post.status === "rejected") throw new Error(`この投稿は状態が ${post.status} のため実行しません`);
  const only = job.params?.slide !== undefined ? Number(job.params.slide) - 1 : undefined;
  const r = await generateImages(db, post, { only, force: true, log });
  await patchPost(db, post.id, { status: post.status === "requested" ? "draft" : post.status, image_request: null, error: null });
  return { postId: post.id, images: r.generated };
}

export const handlers = { propose, write, rewrite, social, social_images: socialImages };
