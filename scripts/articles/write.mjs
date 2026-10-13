/**
 * 承認済みのキーワード候補を記事（下書き）にする（サーバー経路）。
 *
 * 流れ: 候補を取る → ラッコで調査（任意） → Claude が執筆 → 検品 → エラーがあれば 1 回書き直し
 *       → 下書きとして保存 → 候補を「記事化済み」に
 * 公開は行わない。検品に残った問題は generation_log に記録し、管理画面に表示する。
 */
import {
  CATEGORIES,
  SLUG_PATTERN,
  SITE_URL,
  buildContext,
  ensureUniqueSlug,
  fetchLintContext,
  getCandidate,
  lintDraft,
  listCandidates,
  newId,
  parseDraft,
  rest,
  updateCandidate,
} from "./lib.mjs";
import { questionSearch, rakkoAvailable, suggestKeywords, usage as rakkoUsage } from "./rakko.mjs";
import { claudeAvailable, generateText, stripFences } from "./claude.mjs";
import { fixUser, loadGuidelines, writerSystem, writerUser } from "./prompts.mjs";
import { guessCategory } from "./scoring.mjs";

/** 記事化前の調査（ラッコが使えなければ候補に保存済みの材料を使う） */
async function researchKeyword(candidate, areas, log) {
  const fallback = {
    questions: (candidate.faqQuestions ?? []).map((q) => ({ question: q })),
    suggestions: candidate.relatedKeywords ?? [],
  };
  if (!rakkoAvailable()) return fallback;
  try {
    // 質問はエリア名を除いた語（例: 「表参道 髪質改善」→「髪質改善」）で探すほうが集まる
    const tokens = candidate.keyword.split(/[\s　]+/).filter(Boolean);
    const questionKeyword = tokens.filter((t) => !areas.includes(t)).join(" ") || candidate.keyword;
    const [suggestions, questions] = await Promise.all([
      suggestKeywords({ keyword: candidate.keyword, limit: 30 }),
      questionSearch({ keyword: questionKeyword, limit: 20 }),
    ]);
    log(`  調査: 関連 ${suggestions.length} 件 / 質問 ${questions.length} 件（累計 ${rakkoUsage.credits} クレジット）`);
    return { questions, suggestions };
  } catch (err) {
    log(`  調査に失敗したため保存済みの材料で続けます: ${err.message}`);
    return fallback;
  }
}

/** テスト用（ARTICLE_WRITER=mock）の下書き */
function mockDraft(candidate, context) {
  const stylist = context.stylists.find((s) => candidate.targetStylistIds?.includes(s.id)) ?? context.stylists[0];
  const para =
    "髪の状態に合わせてメニューを選ぶことが大切です。くせや広がりの原因は人によって違うため、カウンセリングで髪の履歴を伝えると提案が具体的になります。".repeat(2);
  const section = (h) => `\n## ${h}\n\n${para}\n\n${para}\n\n${para}\n`;
  return `---
title: ${candidate.keyword}｜失敗しない選び方
slug: ${candidate.keyword.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") || "article"}-${Date.now().toString(36)}
category: ${candidate.category ?? "ケア"}
summary: ${candidate.keyword}で迷っている方へ。メニューの違いと料金の目安、失敗しない美容師の選び方を、ポミエの美容師情報とあわせて紹介します。
target_keyword: ${candidate.keyword}
related_stylist_ids: [${stylist ? stylist.id : ""}]
cover_image:
---

${candidate.keyword}を考えている方に向けて、メニューの違いと美容師の選び方を整理します。${para}
${section(`${candidate.keyword}のメニューの違い`)}${section("料金と通う頻度の目安")}${section("失敗しない美容師の選び方")}
## ポミエの美容師に相談するなら

${stylist ? `${stylist.store.name}の [${stylist.name}](/stylists/${stylist.id}) さんは、${stylist.specialtyMenus[0] ?? stylist.menus[0]?.name ?? "カット"}を得意メニューに挙げています。` : ""}

- [美容師一覧を見る](/stylists)
- [相性のいい美容師を診断する](/match)

## よくある質問

### Q. 何回くらい通えばいいですか？

髪の状態によりますが、まずは 1 回受けてから、担当の美容師と次の時期を相談するのがおすすめです。

## まとめ

髪の状態に合ったメニューを選び、カウンセリングで相談することから始めてみてください。
`;
}

/** 1 本書く（検品エラーがあれば 1 回だけ書き直し） */
async function writeOne({ candidate, context, lintCtx, system, research, log }) {
  const user = writerUser({ candidate, context, research });
  const usage = { input: 0, output: 0, cacheRead: 0 };
  let model = null;
  let attempts = 0;

  const first = await generateText({ system, user, mock: () => mockDraft(candidate, context) });
  attempts++;
  model = first.model;
  for (const k of Object.keys(usage)) usage[k] += first.usage[k];
  let text = stripFences(first.text);
  let parsed = parseDraft(text);
  let lint = lintDraft(parsed.meta, parsed.body, lintCtx);

  if (lint.errors.length) {
    log(`  検品でエラー ${lint.errors.length} 件 → 書き直します`);
    const second = await generateText({
      system,
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: text },
        { role: "user", content: fixUser(lint) },
      ],
      mock: () => text,
    });
    attempts++;
    for (const k of Object.keys(usage)) usage[k] += second.usage[k];
    try {
      const t2 = stripFences(second.text);
      const p2 = parseDraft(t2);
      const l2 = lintDraft(p2.meta, p2.body, lintCtx);
      // 書き直しで悪化していなければ採用
      if (l2.errors.length <= lint.errors.length) {
        text = t2;
        parsed = p2;
        lint = l2;
      }
    } catch (err) {
      log(`  書き直しの結果を読めなかったため 1 回目を使います: ${err.message}`);
    }
  }
  return { meta: parsed.meta, body: parsed.body, lint, attempts, usage, model, text };
}

/** 生成結果を下書きとして保存 */
async function saveGenerated(db, candidate, result, context, research) {
  const meta = result.meta;
  const knownIds = new Set(context.allStylists.map((s) => s.id));
  const relatedIds = [...new Set((meta.related_stylist_ids ?? []).filter((id) => knownIds.has(id)))];
  const category = CATEGORIES.includes(meta.category) ? meta.category : candidate.category ?? guessCategory(candidate.keyword);

  // カバー画像: 指定が無ければ紹介する美容師の店舗写真
  let cover = String(meta.cover_image ?? "").trim();
  if (!cover) {
    const first = context.allStylists.find((s) => relatedIds.includes(s.id));
    const store = first ? context.stores.find((st) => st.id === first.storeId) : null;
    cover = store?.image ?? "";
  }

  // slug が形式に合わなければ、候補 ID から作った仮の slug にする（管理画面で直せる）
  let baseSlug = String(meta.slug ?? "").trim().toLowerCase();
  if (!SLUG_PATTERN.test(baseSlug)) baseSlug = `article-${candidate.id.replace(/[^a-z0-9]+/g, "-")}`;
  const slug = await ensureUniqueSlug(db, baseSlug);
  const row = {
    id: newId("ar"),
    slug,
    title: String(meta.title).trim(),
    summary: String(meta.summary ?? "").trim(),
    body: result.body,
    category,
    cover_image: cover,
    related_stylist_ids: relatedIds,
    status: "draft",
    source: "ai",
    target_keyword: candidate.keyword,
    keyword_candidate_id: candidate.id,
    published_at: null,
    generation_log: {
      model: result.model,
      generatedAt: new Date().toISOString(),
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
      cacheReadTokens: result.usage.cacheRead,
      attempts: result.attempts,
      rakkoCredits: rakkoUsage.credits,
      researchQuestions: research.questions.length,
      lintErrors: result.lint.errors.map((e) => e.message),
      lintWarnings: result.lint.warnings.map((w) => w.message),
    },
    updated_at: new Date().toISOString(),
  };
  await rest(db, "POST", "articles", { body: row, prefer: "return=minimal" });
  return row;
}

export async function writeApprovedCandidates({ db, limit = 2, candidateId, dryRun = false, log = console.log }) {
  if (!claudeAvailable()) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません（Claude Code からは /write-article スキルで書けます）");
  }

  let targets;
  if (candidateId) {
    const c = await getCandidate(db, candidateId);
    if (!c) throw new Error(`候補が見つかりません: ${candidateId}`);
    if (!["approved", "failed", "proposed"].includes(c.status)) {
      throw new Error(`候補「${c.keyword}」は状態が ${c.status} のため記事化できません`);
    }
    targets = [c];
  } else {
    targets = (await listCandidates(db, { status: "approved" })).slice(0, limit);
  }
  if (targets.length === 0) {
    log("承認済みの候補はありません");
    return { written: [], failed: [] };
  }

  const [context, lintCtx] = await Promise.all([buildContext(db), fetchLintContext(db)]);
  const system = writerSystem(loadGuidelines());
  const results = { written: [], failed: [] };

  for (const candidate of targets) {
    log(`記事化: ${candidate.keyword}（${candidate.id}）`);
    if (!dryRun) await updateCandidate(db, candidate.id, { status: "writing", error: null });
    try {
      const research = await researchKeyword(candidate, context.taxonomy.areas, log);
      const result = await writeOne({ candidate, context, lintCtx, system, research, log });
      log(
        `  生成: ${result.model} / 入力 ${result.usage.input} tok（キャッシュ ${result.usage.cacheRead}）/ 出力 ${result.usage.output} tok / 試行 ${result.attempts} 回 / 検品 エラー ${result.lint.errors.length}・注意 ${result.lint.warnings.length}`
      );
      if (dryRun) {
        log(`  --dry-run のため保存しません。タイトル: ${result.meta.title}`);
        results.written.push({ keyword: candidate.keyword, title: result.meta.title, dryRun: true });
        continue;
      }
      const article = await saveGenerated(db, candidate, result, context, research);
      await updateCandidate(db, candidate.id, {
        status: "written",
        article_id: article.id,
        written_at: new Date().toISOString(),
        error: null,
        faq_questions: research.questions.map((q) => q.question).slice(0, 10),
        related_keywords: research.suggestions.slice(0, 10).map((s) => ({ keyword: s.keyword, searchVolume: s.searchVolume ?? null })),
      });
      log(`  保存しました（下書き）: ${article.title}`);
      log(`  プレビュー: ${SITE_URL}/admin/articles/${article.id}/preview`);
      results.written.push({ keyword: candidate.keyword, title: article.title, id: article.id, lintErrors: result.lint.errors.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`  失敗: ${message}`);
      if (!dryRun) {
        await updateCandidate(db, candidate.id, { status: "failed", error: message.slice(0, 500) }).catch(() => {});
      }
      results.failed.push({ keyword: candidate.keyword, error: message });
    }
  }
  return results;
}
