/**
 * キーワード候補の提案（サーバー経路）。
 * ラッコキーワード API で種キーワードを調査し、評価して「提案中」として DB に登録する。
 * Claude API があれば企画案（タイトル・切り口・紹介する美容師）も作る。無ければ簡易案。
 */
import { buildContext, insertCandidates, listCandidates, listSeeds, newId, rest } from "./lib.mjs";
import { rakkoAvailable, suggestKeywords, usage as rakkoUsage } from "./rakko.mjs";
import { evaluateKeyword, generateSeeds, guessCategory, heuristicPlan } from "./scoring.mjs";
import { claudeAvailable, extractJson, generateText } from "./claude.mjs";
import { plannerSystem, plannerUser } from "./prompts.mjs";

/**
 * 調査済みの items（ラッコの suggest の結果）から候補の行を作る。
 * コネクタ経路（candidates.mjs add）とサーバー経路で共通。
 */
export function buildCandidateRows({ items, context, existingKeywords, plans = new Map(), limit }) {
  const evaluated = items.map((it) => ({
    ...it,
    ...evaluateKeyword(it, { stylists: context.stylists, existingKeywords, areas: context.taxonomy.areas }),
  }));
  const kept = evaluated.filter((e) => !e.skip).sort((a, b) => b.score - a.score);
  const skipped = evaluated.filter((e) => e.skip);

  const rows = [];
  const seen = new Set();
  for (const it of kept) {
    const plan = plans.get(it.keyword);
    if (plan && plan.keep === false) continue;
    if (seen.has(it.keyword.toLowerCase())) continue;
    seen.add(it.keyword.toLowerCase());
    const h = heuristicPlan(it.keyword, it.intent);
    // 同じ種から出た関連語（執筆時に見出しの参考にする）
    const related = kept
      .filter((o) => o.seed === it.seed && o.keyword !== it.keyword)
      .slice(0, 8)
      .map((o) => ({ keyword: o.keyword, searchVolume: o.searchVolume }));
    rows.push({
      id: newId("kw"),
      keyword: it.keyword,
      seed: it.seed ?? null,
      search_volume: it.searchVolume ?? null,
      seo_difficulty: it.seoDifficulty ?? null,
      competition: it.competition ?? null,
      cpc: it.cpc ?? null,
      intent: plan?.intent ?? it.intent,
      category: plan?.category ?? guessCategory(it.keyword),
      suggested_title: plan?.title ?? h.title,
      angle: plan?.angle ?? h.angle,
      faq_questions: it.faqQuestions ?? [],
      related_keywords: related,
      target_stylist_ids: plan?.target_stylist_ids?.length ? plan.target_stylist_ids : it.targetStylistIds,
      score: it.score,
      reason: plan?.reason ?? it.reason,
      status: "proposed",
    });
    if (limit && rows.length >= limit) break;
  }
  return { rows, skipped };
}

export async function proposeKeywords({
  db,
  limit = 8,
  maxCredits = 30,
  maxSeeds = 4,
  seeds: explicitSeeds,
  dryRun = false,
  log = console.log,
}) {
  if (!rakkoAvailable()) {
    throw new Error("RAKKO_API_KEY が設定されていません（Claude Code からはコネクタを使う /propose-keywords スキルで代替できます）");
  }
  const context = await buildContext(db);
  const existing = await listCandidates(db);
  const existingKeywords = new Set([
    ...existing.map((c) => c.keyword.toLowerCase()),
    ...context.articles.map((a) => (a.targetKeyword ?? "").toLowerCase()).filter(Boolean),
  ]);

  // 種キーワード: 指定 > DB の有効な種 > 美容師データから自動生成
  let seedRows;
  if (explicitSeeds?.length) {
    seedRows = explicitSeeds.map((k) => ({ id: null, keyword: k, lastUsedAt: null }));
  } else {
    seedRows = (await listSeeds(db)).filter((s) => s.enabled);
    if (seedRows.length === 0) {
      const generated = generateSeeds(context.stylists, context.stores);
      if (generated.length === 0) {
        throw new Error("種キーワードを作れません（掲載中の美容師にメニューが入っていません）");
      }
      if (!dryRun) {
        await rest(db, "POST", "keyword_seeds", {
          body: generated.map((k) => ({ id: newId("seed"), keyword: k, enabled: true, note: "美容師の情報から自動生成" })),
          prefer: "return=minimal",
        });
      }
      seedRows = generated.map((k) => ({ id: null, keyword: k, lastUsedAt: null }));
      log(`種キーワードを自動生成しました: ${generated.join(" / ")}`);
    }
  }
  // 長く使っていない種から順に使う
  seedRows.sort((a, b) => String(a.lastUsedAt ?? "") < String(b.lastUsedAt ?? "") ? -1 : 1);
  const chosen = seedRows.slice(0, maxSeeds);

  // 調査
  const items = new Map();
  for (const seed of chosen) {
    if (rakkoUsage.credits >= maxCredits) {
      log(`クレジットの上限（${maxCredits}）に達したため調査を止めます`);
      break;
    }
    const res = await suggestKeywords({ keyword: seed.keyword, limit: 40 });
    log(`調査: ${seed.keyword} → ${res.length} 件（累計 ${rakkoUsage.credits} クレジット）`);
    for (const it of res) if (!items.has(it.keyword)) items.set(it.keyword, { ...it, seed: seed.keyword });
    if (!items.has(seed.keyword)) {
      items.set(seed.keyword, { keyword: seed.keyword, searchVolume: null, seoDifficulty: null, competition: null, cpc: null, seed: seed.keyword });
    }
    if (seed.id && !dryRun) {
      await rest(db, "PATCH", `keyword_seeds?id=eq.${encodeURIComponent(seed.id)}`, {
        body: { last_used_at: new Date().toISOString() },
        prefer: "return=minimal",
      });
    }
  }

  // 評価 → 上位を企画
  const { rows: shortlist } = buildCandidateRows({ items: [...items.values()], context, existingKeywords, limit: Math.max(limit * 2, 10) });
  let plans = new Map();
  if (claudeAvailable() && shortlist.length) {
    try {
      const planInput = shortlist.map((r) => ({
        keyword: r.keyword,
        searchVolume: r.search_volume,
        seoDifficulty: r.seo_difficulty,
        intent: r.intent,
        targetStylistIds: r.target_stylist_ids,
      }));
      const { text } = await generateText({
        system: plannerSystem(),
        user: plannerUser({ items: planInput, context }),
        maxTokens: 8000,
        mock: () =>
          JSON.stringify(
            planInput.map((it) => ({
              keyword: it.keyword,
              keep: true,
              title: heuristicPlan(it.keyword, it.intent).title,
              angle: "（テスト用の企画案）",
              category: guessCategory(it.keyword),
              intent: it.intent,
              target_stylist_ids: it.targetStylistIds,
              reason: "テスト",
            }))
          ),
      });
      for (const p of extractJson(text)) if (p && p.keyword) plans.set(String(p.keyword).trim(), p);
      log(`企画案を作成しました（${plans.size} 件）`);
    } catch (err) {
      log(`企画案の作成に失敗したため簡易案を使います: ${err.message}`);
    }
  }

  const { rows, skipped } = buildCandidateRows({ items: [...items.values()], context, existingKeywords, plans, limit });
  if (!dryRun && rows.length) await insertCandidates(db, rows);
  return { proposed: rows, skippedCount: skipped.length, credits: rakkoUsage.credits, seeds: chosen.map((s) => s.keyword) };
}
