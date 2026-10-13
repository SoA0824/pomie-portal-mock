/**
 * キーワード候補の操作（コネクタ経路 = Claude Code のスキルから使う）。
 *
 *   node scripts/articles/candidates.mjs list [--status proposed|approved|written|failed|rejected] [--json]
 *   node scripts/articles/candidates.mjs show <候補ID または キーワード>
 *   node scripts/articles/candidates.mjs seeds [--auto]        … 種キーワード一覧。--auto で無ければ自動生成して登録
 *   node scripts/articles/candidates.mjs score --file rakko.json [--seed "表参道 髪質改善"] [--json]
 *                                              … ラッコ（コネクタ/API）の items を評価して並べる
 *   node scripts/articles/candidates.mjs add --file candidates.json
 *                                              … 企画済みの候補を「提案中」として登録
 *   node scripts/articles/candidates.mjs decide <候補ID> approved|rejected [--note "..."]
 *
 * 共通: --target production|mock
 */
import fs from "node:fs";
import {
  CATEGORIES,
  buildContext,
  getCandidate,
  insertCandidates,
  listCandidates,
  listSeeds,
  loadDb,
  newId,
  parseArgs,
  rest,
  updateCandidate,
} from "./lib.mjs";
import { normalizeKeywordItem } from "./rakko.mjs";
import { buildCandidateRows } from "./propose.mjs";
import { classifyIntent, evaluateKeyword, generateSeeds, guessCategory, heuristicPlan } from "./scoring.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

function readJsonFile(file) {
  if (typeof file !== "string") throw new Error("--file でファイルを指定してください");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** ラッコの応答（API / MCP）から items を取り出す */
function extractItems(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (json.data && Array.isArray(json.data.items)) return json.data.items;
  throw new Error("items 配列が見つかりません（ラッコの応答 JSON をそのまま保存してください）");
}

function fmt(c) {
  return `[${String(Math.round(c.score ?? 0)).padStart(3)}] ${c.keyword}  検索数 ${c.searchVolume ?? "?"} / 難易度 ${c.seoDifficulty ?? "?"} / ${c.intent ?? "?"} / 美容師 ${(c.targetStylistIds ?? []).join(",") || "なし"}`;
}

async function main() {
  const db = loadDb(args.target ?? "production");

  if (cmd === "list") {
    const rows = await listCandidates(db, { status: typeof args.status === "string" ? args.status : undefined });
    if (args.json) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    if (rows.length === 0) {
      console.log("候補はありません");
      return;
    }
    for (const c of rows) {
      console.log(`${c.id}  ${c.status.padEnd(8)} ${fmt(c)}`);
      if (c.suggestedTitle) console.log(`           ${c.suggestedTitle}`);
      if (c.note) console.log(`           メモ: ${c.note}`);
    }
    return;
  }

  if (cmd === "show") {
    const c = await getCandidate(db, args._[1] ?? "");
    if (!c) throw new Error(`候補が見つかりません: ${args._[1]}`);
    console.log(JSON.stringify(c, null, 2));
    return;
  }

  if (cmd === "seeds") {
    let seeds = await listSeeds(db);
    if (seeds.length === 0 && args.auto) {
      const context = await buildContext(db);
      const generated = generateSeeds(context.stylists, context.stores);
      if (generated.length === 0) throw new Error("種キーワードを作れません（掲載中の美容師にメニューが入っていません）");
      await rest(db, "POST", "keyword_seeds", {
        body: generated.map((k) => ({ id: newId("seed"), keyword: k, enabled: true, note: "美容師の情報から自動生成" })),
        prefer: "return=minimal",
      });
      console.log(`種キーワードを自動生成して登録しました: ${generated.join(" / ")}`);
      seeds = await listSeeds(db);
    }
    if (args.json) {
      console.log(JSON.stringify(seeds, null, 2));
      return;
    }
    if (seeds.length === 0) {
      console.log("種キーワードはありません（--auto で美容師の情報から自動生成できます）");
      return;
    }
    for (const s of seeds) console.log(`${s.enabled ? "✓" : "－"} ${s.keyword}${s.lastUsedAt ? `（最終使用 ${s.lastUsedAt.slice(0, 10)}）` : ""}`);
    return;
  }

  if (cmd === "score") {
    const items = extractItems(readJsonFile(args.file)).map(normalizeKeywordItem).map((it) => ({ ...it, seed: typeof args.seed === "string" ? args.seed : null }));
    const context = await buildContext(db);
    const existing = await listCandidates(db);
    const existingKeywords = new Set([
      ...existing.map((c) => c.keyword.toLowerCase()),
      ...context.articles.map((a) => (a.targetKeyword ?? "").toLowerCase()).filter(Boolean),
    ]);
    const evaluated = items
      .map((it) => ({ ...it, ...evaluateKeyword(it, { stylists: context.stylists, existingKeywords, areas: context.taxonomy.areas }) }))
      .sort((a, b) => b.score - a.score);
    if (args.json) {
      console.log(JSON.stringify(evaluated, null, 2));
      return;
    }
    for (const e of evaluated) {
      console.log(`${e.skip ? "✗" : "○"} ${fmt(e)}${e.skip ? `  ← 除外: ${e.skip}` : e.reason ? `  （${e.reason}）` : ""}`);
    }
    return;
  }

  if (cmd === "add") {
    const input = readJsonFile(args.file);
    const list = Array.isArray(input) ? input : input.candidates;
    if (!Array.isArray(list)) throw new Error("候補の配列が必要です");
    const context = await buildContext(db);
    const existing = await listCandidates(db);
    const existingKeywords = new Set([
      ...existing.map((c) => c.keyword.toLowerCase()),
      ...context.articles.map((a) => (a.targetKeyword ?? "").toLowerCase()).filter(Boolean),
    ]);
    const knownIds = new Set(context.allStylists.map((s) => s.id));
    const rows = [];
    for (const c of list) {
      const keyword = String(c.keyword ?? "").trim().replace(/\s+/g, " ");
      if (!keyword) continue;
      if (existingKeywords.has(keyword.toLowerCase())) {
        console.log(`スキップ（既にあります）: ${keyword}`);
        continue;
      }
      const base = evaluateKeyword(
        { keyword, searchVolume: c.searchVolume ?? null, seoDifficulty: c.seoDifficulty ?? null, competition: c.competition ?? null, cpc: c.cpc ?? null },
        { stylists: context.stylists, existingKeywords, areas: context.taxonomy.areas }
      );
      const intent = c.intent ?? base.intent ?? classifyIntent(keyword);
      const plan = heuristicPlan(keyword, intent);
      const targetIds = (c.targetStylistIds ?? base.targetStylistIds ?? []).filter((id) => {
        if (knownIds.has(id)) return true;
        console.log(`  ${keyword}: 美容師 ${id} は存在しないため外しました`);
        return false;
      });
      rows.push({
        id: newId("kw"),
        keyword,
        seed: c.seed ?? null,
        search_volume: c.searchVolume ?? null,
        seo_difficulty: c.seoDifficulty ?? null,
        competition: c.competition ?? null,
        cpc: c.cpc ?? null,
        intent,
        category: CATEGORIES.includes(c.category) ? c.category : guessCategory(keyword),
        suggested_title: c.suggestedTitle ?? plan.title,
        angle: c.angle ?? plan.angle,
        faq_questions: Array.isArray(c.faqQuestions) ? c.faqQuestions.map(String) : [],
        related_keywords: Array.isArray(c.relatedKeywords) ? c.relatedKeywords : [],
        target_stylist_ids: targetIds,
        score: typeof c.score === "number" ? c.score : base.score,
        reason: c.reason ?? base.reason,
        status: "proposed",
      });
      existingKeywords.add(keyword.toLowerCase());
    }
    if (rows.length === 0) {
      console.log("登録する候補がありません");
      return;
    }
    await insertCandidates(db, rows);
    console.log(`${rows.length} 件を「提案中」として登録しました。管理画面 /admin/keywords で承認してください。`);
    for (const r of rows) console.log(`  ${r.id}  ${r.keyword}  → ${r.suggested_title}`);
    return;
  }

  if (cmd === "decide") {
    const c = await getCandidate(db, args._[1] ?? "");
    if (!c) throw new Error(`候補が見つかりません: ${args._[1]}`);
    const decision = args._[2];
    if (!["approved", "rejected"].includes(decision)) throw new Error("approved か rejected を指定してください");
    await updateCandidate(db, c.id, { status: decision, decided_at: new Date().toISOString(), ...(typeof args.note === "string" ? { note: args.note } : {}) });
    console.log(`${c.keyword} → ${decision}`);
    return;
  }

  // buildCandidateRows は propose.mjs と共有（未使用警告を避けるため参照）
  void buildCandidateRows;
  console.log(`使い方は scripts/articles/candidates.mjs の先頭を参照してください（list / show / seeds / score / add / decide）`);
  process.exit(2);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
