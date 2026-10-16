/**
 * 記事のリライト（コネクタ経路 = Claude Code の /rewrite-article から使う）。
 *
 *   node scripts/articles/rewrite.mjs list
 *       … 依頼済み（リライト待ち）の一覧
 *   node scripts/articles/rewrite.mjs request --article <slug|id> --instruction "..." [--remove st-a,st-b] [--add st-c]
 *       … チャットからリライトを依頼する（管理画面からの依頼と同じ扱い）
 *   node scripts/articles/rewrite.mjs analyze <slug|id> [--gsc queries.csv] [--json]
 *       … 記事の状況を分析する（保存はしない）
 *   node scripts/articles/rewrite.mjs context <依頼ID> [--gsc queries.csv] [--out ディレクトリ]
 *       … リライトの材料（依頼・記事・分析・美容師）を JSON で出し、今の記事を編集用の
 *         Markdown（content/rewrites/<slug>.md）に書き出す
 *   node scripts/articles/rewrite.mjs save <依頼ID> --file content/rewrites/<slug>.md --analysis "..." --summary "..."
 *       … 検品して「提案あり」として保存（管理画面で承認すると記事に反映）
 *       （長い文章は --analysis-file / --summary-file でファイルから渡せる）
 *   node scripts/articles/rewrite.mjs fail <依頼ID> --reason "..."
 *
 * 共通: --target production|mock
 * --gsc には Search Console の「検索パフォーマンス → クエリ」を書き出した CSV を渡せる。
 */
import fs from "node:fs";
import path from "node:path";
import {
  AREAS,
  ROOT,
  SITE_URL,
  buildContext,
  fetchLintContext,
  keywordOverlap,
  lintDraft,
  loadDb,
  newId,
  parseArgs,
  printLint,
  readDraft,
  rest,
} from "./lib.mjs";
import { matchStylists } from "./scoring.mjs";

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const REWRITES_DIR = path.join(ROOT, "content", "rewrites");

// ---------------------------------------------------------------------------

async function getArticle(db, slugOrId) {
  const q = (col) => `articles?select=*&${col}=eq.${encodeURIComponent(slugOrId)}&limit=1`;
  const [byId] = await rest(db, "GET", q("id"));
  if (byId) return byId;
  const [bySlug] = await rest(db, "GET", q("slug"));
  if (bySlug) return bySlug;
  throw new Error(`記事が見つかりません: ${slugOrId}`);
}

async function getRevision(db, id) {
  const [rev] = await rest(db, "GET", `article_revisions?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rev) throw new Error(`リライトの依頼が見つかりません: ${id}`);
  return rev;
}

async function patchRevision(db, id, body) {
  await rest(db, "PATCH", `article_revisions?id=eq.${encodeURIComponent(id)}`, {
    body: { ...body, updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
}

function formatYen(n) {
  return `¥${Number(n).toLocaleString("ja-JP")}`;
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Search Console の「クエリ」CSV を読む（日本語・英語の見出しに対応） */
function readGscCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const idx = (...names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iq = idx("クエリ", "query");
  const ic = idx("クリック", "click");
  const ii = idx("表示回数", "impression");
  const ir = idx("ctr");
  const ip = idx("掲載順位", "position");
  if (iq < 0 || ii < 0) throw new Error("CSV に「クエリ」「表示回数」の列が見つかりません（Search Console のクエリを書き出したものを渡してください）");
  const num = (s) => Number(String(s ?? "").replace(/[%,]/g, "")) || 0;
  return lines.slice(1).map((l) => {
    const c = split(l);
    return {
      query: c[iq],
      clicks: ic >= 0 ? num(c[ic]) : null,
      impressions: num(c[ii]),
      ctr: ir >= 0 ? num(c[ir]) : null,
      position: ip >= 0 ? num(c[ip]) : null,
    };
  });
}

/** 記事の状況を分析する */
async function analyzeArticle(db, article, { gscFile } = {}) {
  const [context, lintCtx] = await Promise.all([buildContext(db), fetchLintContext(db)]);
  const stylistById = new Map(context.allStylists.map((s) => [s.id, s]));
  const detailById = new Map(context.stylists.map((s) => [s.id, s]));
  const body = article.body ?? "";

  const lint = lintDraft(
    {
      title: article.title,
      slug: article.slug,
      category: article.category,
      summary: article.summary,
      target_keyword: article.target_keyword,
      related_stylist_ids: article.related_stylist_ids ?? [],
      cover_image: article.cover_image,
    },
    body,
    lintCtx
  );

  // 紹介中の美容師の状態
  const relatedStylists = (article.related_stylist_ids ?? []).map((id) => {
    const s = stylistById.get(id);
    const d = detailById.get(id);
    return {
      id,
      name: s?.name ?? "(削除済み)",
      status: !s ? "deleted" : s.active ? "active" : "inactive",
      mentionedInBody: s ? body.includes(s.name) : false,
      menus: d?.menus ?? [],
      priceRange: d?.priceRange ?? null,
      store: d?.store ?? null,
    };
  });

  const issues = [];
  for (const s of relatedStylists) {
    if (s.status === "deleted") issues.push(`紹介中の美容師 ${s.id} は削除されています。差し替えが必要です`);
    if (s.status === "inactive") issues.push(`紹介中の美容師 ${s.name} は非公開です。差し替えが必要です`);
  }

  // 本文の料金表記と、今の料金目安が合っているか
  const currentRanges = new Set(
    relatedStylists.filter((s) => s.priceRange && (s.priceRange.min > 0 || s.priceRange.max > 0)).map((s) => `${formatYen(s.priceRange.min)}〜${formatYen(s.priceRange.max)}`)
  );
  const bodyRanges = [...new Set([...body.matchAll(/¥[\d,]+〜¥[\d,]+/g)].map((m) => m[0]))];
  for (const r of bodyRanges) {
    if (currentRanges.size && !currentRanges.has(r)) issues.push(`本文の料金表記「${r}」が、紹介中の美容師の今の料金目安（${[...currentRanges].join(" / ")}）と一致しません`);
  }

  // 本文の「メニュー名（N 分）」と、今の施術時間が合っているか
  const menuDur = new Map(relatedStylists.flatMap((s) => s.menus.filter((m) => m.duration).map((m) => [m.name, m.duration])));
  const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [name, duration] of menuDur) {
    for (const m of body.matchAll(new RegExp(`${escapeRe(name)}[*_]*\\s*[（(]\\s*(?:約\\s*)?(\\d+)\\s*分`, "g"))) {
      if (Number(m[1]) !== duration) issues.push(`本文の「${name}（${m[1]} 分）」が、今の施術時間（${duration} 分）と一致しません`);
    }
  }

  // キーワードに合う、まだ紹介していない掲載中の美容師
  const keyword = article.target_keyword ?? article.title;
  const candidatesToAdd = matchStylists(keyword, context.stylists)
    .filter((m) => m.termHit && !(article.related_stylist_ids ?? []).includes(m.id))
    .map((m) => ({ id: m.id, name: detailById.get(m.id)?.name, menus: detailById.get(m.id)?.menus.map((x) => x.name) }));

  // 同じキーワードを狙う他の記事（食い合い）
  const others = context.articles.filter((a) => a.id !== article.id);
  const overlap = keywordOverlap(keyword, others);

  // Search Console
  let gsc = null;
  if (gscFile) {
    const rows = readGscCsv(gscFile);
    const totals = rows.reduce((t, r) => ({ clicks: t.clicks + (r.clicks ?? 0), impressions: t.impressions + r.impressions }), { clicks: 0, impressions: 0 });
    const lowCtr = rows.filter((r) => r.impressions >= 50 && r.ctr !== null && r.ctr < 2).slice(0, 10);
    const nearTop = rows.filter((r) => r.position !== null && r.position >= 8 && r.position <= 20).slice(0, 10);
    const notInBody = rows
      .filter((r) => r.impressions >= 20)
      .filter((r) => r.query.split(/[\s　]+/).some((t) => t && !body.includes(t) && !article.title.includes(t)))
      .slice(0, 10);
    gsc = { totals, topQueries: rows.slice(0, 15), lowCtr, nearTop, notInBody };
  }

  const todo = (body.match(/\[要確認[^\]]*\]/g) ?? []).length;
  return {
    article: {
      id: article.id,
      slug: article.slug,
      url: `${SITE_URL}/articles/${article.slug}`,
      title: article.title,
      status: article.status,
      category: article.category,
      targetKeyword: article.target_keyword,
      areas: article.areas ?? [],
      ageDaysSincePublished: daysSince(article.published_at),
      ageDaysSinceUpdated: daysSince(article.updated_at),
      todoMarkers: todo,
    },
    lint: { errors: lint.errors.map((e) => e.message), warnings: lint.warnings.map((w) => w.message) },
    relatedStylists,
    issues,
    candidatesToAdd,
    overlap: overlap.overlapping.filter((o) => o.matchedTokens.length >= 2).slice(0, 5),
    gsc,
    searchConsole: gsc ? "CSV から読み込み済み" : "未提供（Search Console のクエリ CSV を --gsc で渡すと、表示回数・掲載順位を踏まえて分析できます）",
  };
}

function printAnalysis(a) {
  console.log(`記事: ${a.article.title}（${a.article.status === "published" ? "公開中" : "下書き"}）`);
  console.log(`  ${a.article.url}`);
  console.log(`  キーワード: ${a.article.targetKeyword ?? "なし"} / 公開から ${a.article.ageDaysSincePublished ?? "-"} 日 / 最終更新から ${a.article.ageDaysSinceUpdated ?? "-"} 日`);
  console.log(`\n紹介中の美容師:`);
  for (const s of a.relatedStylists) console.log(`  - ${s.name}（${s.status === "active" ? "掲載中" : s.status === "inactive" ? "非公開" : "削除済み"}）${s.mentionedInBody ? "" : " ※本文に名前なし"}`);
  if (a.relatedStylists.length === 0) console.log("  なし");
  console.log(`\n気になる点:`);
  for (const i of a.issues) console.log(`  ! ${i}`);
  for (const e of a.lint.errors) console.log(`  ✗ ${e}`);
  for (const w of a.lint.warnings) console.log(`  ・${w}`);
  if (!a.issues.length && !a.lint.errors.length && !a.lint.warnings.length) console.log("  特になし");
  if (a.candidatesToAdd.length) console.log(`\n追加を検討できる美容師: ${a.candidatesToAdd.map((c) => `${c.name}（${c.id}）`).join("、")}`);
  if (a.overlap.length) console.log(`\n狙いが近い記事: ${a.overlap.map((o) => `${o.title}（${o.status}）`).join("、")}`);
  console.log(`\nSearch Console: ${a.searchConsole}`);
  if (a.gsc) {
    console.log(`  合計 クリック ${a.gsc.totals.clicks} / 表示 ${a.gsc.totals.impressions}`);
    for (const r of a.gsc.nearTop) console.log(`  あと一歩（${r.position} 位）: ${r.query}（表示 ${r.impressions}）`);
    for (const r of a.gsc.lowCtr) console.log(`  クリック率が低い（${r.ctr}%）: ${r.query}（表示 ${r.impressions}）`);
    for (const r of a.gsc.notInBody) console.log(`  本文に無い語を含むクエリ: ${r.query}（表示 ${r.impressions}）`);
  }
}

/** 記事をリライト用の Markdown にする（slug は変えないので書かない） */
function articleToDraft(article, extra = {}) {
  const list = (a) => `[${(a ?? []).join(", ")}]`;
  return `---
title: ${article.title}
category: ${article.category}
summary: ${article.summary}
target_keyword: ${article.target_keyword ?? ""}
related_stylist_ids: ${list(extra.relatedStylistIds ?? article.related_stylist_ids)}
areas: ${list(article.areas)}
base_updated_at: ${article.updated_at}
---

${(article.body ?? "").trim()}
`;
}

// ---------------------------------------------------------------------------

async function main() {
  const db = loadDb(args.target ?? "production");

  if (cmd === "list") {
    const revs = await rest(db, "GET", "article_revisions?select=*&status=eq.requested&order=requested_at");
    if (!revs.length) {
      console.log("リライト待ちの依頼はありません");
      return;
    }
    for (const r of revs) {
      const a = await getArticle(db, r.article_id).catch(() => null);
      console.log(`${r.id}  ${a ? a.title : "(記事なし)"}  /articles/${a?.slug ?? "-"}`);
      if (r.instruction) console.log(`    指示: ${r.instruction.replace(/\n/g, " / ")}`);
      const sw = r.stylist_swap ?? {};
      if ((sw.remove ?? []).length || (sw.add ?? []).length) console.log(`    美容師: 外す ${(sw.remove ?? []).join(",") || "-"} / 加える ${(sw.add ?? []).join(",") || "-"}`);
    }
    return;
  }

  if (cmd === "request") {
    if (typeof args.article !== "string") throw new Error("--article に記事の slug か ID を指定してください");
    const article = await getArticle(db, args.article);
    const csv = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
    const instruction = typeof args.instruction === "string" ? args.instruction : "";
    const swap = { remove: csv(args.remove), add: csv(args.add) };
    if (!instruction && !swap.remove.length && !swap.add.length) throw new Error("--instruction か --remove / --add を指定してください");
    const id = newId("rv");
    await rest(db, "POST", "article_revisions", {
      body: { id, article_id: article.id, status: "requested", instruction, stylist_swap: swap },
      prefer: "return=minimal",
    });
    console.log(`リライトを依頼しました: ${id}（${article.title}）`);
    return;
  }

  if (cmd === "analyze") {
    const article = await getArticle(db, args._[1] ?? "");
    const a = await analyzeArticle(db, article, { gscFile: typeof args.gsc === "string" ? args.gsc : undefined });
    if (args.json) console.log(JSON.stringify(a, null, 2));
    else printAnalysis(a);
    return;
  }

  if (cmd === "context") {
    const rev = await getRevision(db, args._[1] ?? "");
    if (rev.status !== "requested" && !args.force) throw new Error(`この依頼は状態が ${rev.status} です（作り直すなら --force）`);
    const article = await getArticle(db, rev.article_id);
    const analysis = await analyzeArticle(db, article, { gscFile: typeof args.gsc === "string" ? args.gsc : undefined });
    const context = await buildContext(db);
    const swap = rev.stylist_swap ?? {};
    // 差し替え後の紹介する美容師（下書きの初期値）
    const nextRelated = [
      ...(article.related_stylist_ids ?? []).filter((id) => !(swap.remove ?? []).includes(id)),
      ...(swap.add ?? []).filter((id) => !(article.related_stylist_ids ?? []).includes(id)),
    ];
    const detail = (id) => context.stylists.find((s) => s.id === id) ?? context.allStylists.find((s) => s.id === id) ?? { id };
    // 加える美容師が非公開・別エリアでないか
    const areaNames = (article.areas ?? []).map((a) => AREAS.find((x) => x.slug === a)?.name).filter(Boolean);
    for (const id of swap.add ?? []) {
      const s = context.stylists.find((x) => x.id === id);
      if (!s) analysis.issues.push(`加える美容師 ${id} は掲載中ではありません（記事には表示されません）`);
      else if (areaNames.length && !areaNames.includes(s.store?.area)) {
        analysis.issues.push(`加える美容師 ${s.name} は${s.store?.area || "別"}の店舗です（記事のエリア: ${areaNames.join("・")}）。エリアの書き方を合わせてください`);
      }
    }
    const out = {
      revision: { id: rev.id, instruction: rev.instruction, stylistSwap: swap },
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        category: article.category,
        status: article.status,
        targetKeyword: article.target_keyword,
        relatedStylistIds: article.related_stylist_ids ?? [],
        areas: article.areas ?? [],
        updatedAt: article.updated_at,
      },
      analysis,
      stylists: {
        remove: (swap.remove ?? []).map(detail),
        add: (swap.add ?? []).map(detail),
        keep: nextRelated.filter((id) => !(swap.add ?? []).includes(id)).map(detail),
      },
      allActiveStylists: context.stylists,
      stores: context.stores,
      publishedArticles: context.articles.filter((a) => a.status === "published" && a.id !== article.id).map((a) => ({ slug: a.slug, title: a.title })),
    };
    const outDir = typeof args.out === "string" ? args.out : "/tmp";
    fs.mkdirSync(outDir, { recursive: true });
    const jsonFile = path.join(outDir, `pomie-rewrite-${rev.id}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(out, null, 2));
    fs.mkdirSync(REWRITES_DIR, { recursive: true });
    const draftFile = path.join(REWRITES_DIR, `${article.slug}.md`);
    fs.writeFileSync(draftFile, articleToDraft(article, { relatedStylistIds: nextRelated }));
    console.log(`材料: ${jsonFile}`);
    console.log(`編集用の下書き: ${path.relative(process.cwd(), draftFile)}（今の記事。紹介する美容師は差し替え後の値）`);
    printAnalysis(analysis);
    return;
  }

  if (cmd === "save") {
    const rev = await getRevision(db, args._[1] ?? "");
    if (!["requested", "failed"].includes(rev.status) && !args.force) throw new Error(`この依頼は状態が ${rev.status} です（上書きするなら --force）`);
    if (typeof args.file !== "string") throw new Error("--file にリライトした Markdown を指定してください");
    const article = await getArticle(db, rev.article_id);
    const { meta, body } = readDraft(args.file);
    const readText = (inline, file) => (typeof file === "string" ? fs.readFileSync(file, "utf8").trim() : typeof inline === "string" ? inline.trim() : "");
    const analysis = readText(args.analysis, args["analysis-file"]);
    const summary = readText(args.summary, args["summary-file"]);
    if (!summary) throw new Error("--summary（変更点の要約）を指定してください。管理画面で承認の判断に使います");

    // slug（URL）はリライトでは変えない
    const draftMeta = { ...meta, slug: article.slug };
    const lintCtx = await fetchLintContext(db);
    const lint = lintDraft(draftMeta, body, lintCtx);
    console.log(`検品: ${args.file}`);
    printLint(lint);
    if (lint.errors.length) {
      console.log(`\nエラー ${lint.errors.length} 件のため保存しませんでした。`);
      process.exit(1);
    }
    const toList = (v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(/[,\s]+/) : null);
    await patchRevision(db, rev.id, {
      status: "proposed",
      analysis: analysis || null,
      change_summary: summary,
      proposed_title: String(meta.title ?? article.title).trim(),
      proposed_summary: String(meta.summary ?? article.summary ?? "").trim(),
      proposed_body: body,
      proposed_category: meta.category ?? article.category,
      proposed_related_stylist_ids: toList(meta.related_stylist_ids) ?? article.related_stylist_ids ?? [],
      proposed_areas: toList(meta.areas) ?? article.areas ?? [],
      base_updated_at: meta.base_updated_at || article.updated_at,
      lint: { errors: [], warnings: lint.warnings.map((w) => w.message) },
      error: null,
      proposed_at: new Date().toISOString(),
    });
    console.log(`\nリライト案を保存しました（承認待ち）: ${article.title}`);
    console.log(`  確認・承認: ${SITE_URL}/admin/articles/${article.id}/edit`);
    return;
  }

  if (cmd === "fail") {
    const rev = await getRevision(db, args._[1] ?? "");
    await patchRevision(db, rev.id, { status: "failed", error: typeof args.reason === "string" ? args.reason : "リライトに失敗しました" });
    console.log("失敗として記録しました");
    return;
  }

  console.log("使い方は scripts/articles/rewrite.mjs の先頭を参照してください（list / request / analyze / context / save / fail）");
  process.exit(2);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
