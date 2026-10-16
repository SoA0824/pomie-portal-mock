/**
 * 記事の自動執筆パイプライン 共通処理
 *
 * 依存パッケージなし（Node 18 以上の標準機能だけで動く）。
 * - DB 接続先の読み込み（本番 / モック）
 * - Supabase REST（PostgREST）の呼び出し
 * - 下書きファイル（フロントマター付き Markdown）の読み込み
 * - 記事の検品（lint）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DRAFTS_DIR = path.join(ROOT, "content", "drafts");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://portal.pomie.jp").replace(/\/$/, "");

/** src/lib/types.ts の ARTICLE_CATEGORIES と合わせること */
export const CATEGORIES = ["カット", "カラー", "メンズ", "ケア", "エリア"];

/**
 * 記事のエリア（タグ）。src/lib/areas.ts の AREAS と合わせること。
 * slug はエリアの記事一覧 /articles/{slug} に使うため、記事の slug には使えない。
 */
export const AREAS = [
  { slug: "omotesando", name: "表参道", storeIds: ["s1"] },
  { slug: "ebisu", name: "恵比寿", storeIds: ["s2"] },
];

/**
 * 記事のエリアを決める。キーワード・タイトルに地名があればそれ、
 * 無ければ紹介する美容師の所属店舗のエリア。
 */
export function deriveAreas({ keyword = "", title = "", stylistStoreIds = [] } = {}) {
  const byText = AREAS.filter((a) => `${keyword} ${title}`.includes(a.name)).map((a) => a.slug);
  if (byText.length) return byText;
  return AREAS.filter((a) => a.storeIds.some((id) => stylistStoreIds.includes(id))).map((a) => a.slug);
}
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 検品の目安 */
export const TITLE_MAX = 36; // 検索結果に出るのは 30 文字前後
export const SUMMARY_LENGTH = { min: 60, max: 140 };
export const BODY_LENGTH = { min: 2000, max: 6000 }; // 空白を除いた文字数

// ---------------------------------------------------------------------------
// 引数・環境変数
// ---------------------------------------------------------------------------

/** `--key value` / `--flag` / 位置引数 を読む */
export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/**
 * 接続先の Supabase を決める。
 *
 *   production（既定）… .env.production.local（本番サイトと同じ DB）
 *   mock              … .env.local（ローカル開発・モック用 DB）
 *
 * テスト用に ARTICLES_SUPABASE_URL / ARTICLES_SUPABASE_ANON_KEY で上書きできる。
 */
export function loadDb(target = "production") {
  if (process.env.ARTICLES_SUPABASE_URL && process.env.ARTICLES_SUPABASE_ANON_KEY) {
    const url = process.env.ARTICLES_SUPABASE_URL.replace(/\/$/, "");
    return { url, key: process.env.ARTICLES_SUPABASE_ANON_KEY, label: `環境変数 (${hostOf(url)})` };
  }
  if (target !== "production" && target !== "mock") {
    throw new Error(`--target は production か mock を指定してください（指定値: ${target}）`);
  }
  const file = target === "mock" ? ".env.local" : ".env.production.local";
  const env = parseEnvFile(path.join(ROOT, file));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      [
        `${file} に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY が必要です。`,
        target === "production"
          ? "本番サイトと同じ DB に下書きを保存するため、Vercel の Environment Variables にある 2 つの値を" +
            " プロジェクト直下の .env.production.local に書いてください（Git には含まれません）。"
          : ".env.local はローカル開発用の設定ファイルです。",
      ].join("\n")
    );
  }
  return { url: url.replace(/\/$/, ""), key, label: `${file} (${hostOf(url)})` };
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Supabase REST
// ---------------------------------------------------------------------------

/**
 * PostgREST を呼ぶ。例: rest(db, "GET", "articles?select=id,slug&status=eq.draft")
 */
export async function rest(db, method, pathAndQuery, { body, prefer } = {}) {
  const url = `${db.url}/rest/v1/${pathAndQuery}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        apikey: db.key,
        Authorization: `Bearer ${db.key}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Supabase に接続できません（${hostOf(db.url)}）: ${err?.cause?.message ?? err.message}\n` +
        "  接続先が正しいか、Supabase のプロジェクトが一時停止（Paused）していないか確認してください。"
    );
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" ? data.message || data.hint || JSON.stringify(data) : String(data);
    const table = pathAndQuery.split("?")[0];
    const migration = { articles: "migration-008-articles.sql", keyword_candidates: "migration-009-keyword-pipeline.sql", keyword_seeds: "migration-009-keyword-pipeline.sql", article_revisions: "migration-012-article-revisions.sql" }[table];
    const hint = /relation .* does not exist|Could not find the table/.test(msg) && migration
      ? `\n  テーブル ${table} が未作成の可能性があります。Supabase の SQL Editor で supabase/${migration} を実行してください。`
      : "";
    throw new Error(`Supabase ${method} ${pathAndQuery.split("?")[0]} → HTTP ${res.status}: ${msg}${hint}`);
  }
  return data;
}

/** 記事の検品・保存に使う最小限の文脈（美容師 / 記事一覧）を取る */
export async function fetchLintContext(db) {
  const [stylists, articles] = await Promise.all([
    rest(db, "GET", "stylists?select=id,name,contract_status,store_id&order=id"),
    rest(db, "GET", "articles?select=id,slug,title,status,target_keyword"),
  ]);
  return {
    stylists: new Map(stylists.map((s) => [s.id, { name: s.name, active: s.contract_status === "active", storeId: s.store_id }])),
    articles: new Map(articles.map((a) => [a.slug, a])),
  };
}

// ---------------------------------------------------------------------------
// 下書きファイル（フロントマター付き Markdown）
// ---------------------------------------------------------------------------

function unquote(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

/**
 * 先頭の --- ... --- をフロントマターとして読む。
 * 対応する書き方:
 *   key: 値
 *   key: [a, b, c]
 *   key:
 *     - a
 *     - b
 */
export function parseDraft(text) {
  const m = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    throw new Error("ファイルの先頭に --- で囲んだフロントマター（title, slug, category など）が必要です");
  }
  const meta = {};
  let currentKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(unquote(item[1]));
      continue;
    }
    const kv = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) throw new Error(`フロントマターの書き方が不正です: ${raw}`);
    currentKey = kv[1];
    const v = kv[2].trim();
    if (v === "") {
      meta[currentKey] = [];
    } else if (v.startsWith("[") && v.endsWith("]")) {
      meta[currentKey] = v
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s))
        .filter(Boolean);
    } else {
      meta[currentKey] = unquote(v);
    }
  }
  // 「cover_image:」のように値が空の項目は、配列ではなく空文字として扱う
  for (const key of ["title", "slug", "category", "summary", "target_keyword", "cover_image"]) {
    if (Array.isArray(meta[key])) meta[key] = meta[key].join(", ");
  }
  // related_stylist_ids は "st-a, st-b" のような書き方も受け付ける
  if (typeof meta.related_stylist_ids === "string") {
    meta.related_stylist_ids = meta.related_stylist_ids
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (meta.related_stylist_ids === undefined) meta.related_stylist_ids = [];
  return { meta, body: m[2].trim() + "\n" };
}

export function readDraft(file) {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) throw new Error(`ファイルが見つかりません: ${abs}`);
  return { file: abs, ...parseDraft(fs.readFileSync(abs, "utf8")) };
}

// ---------------------------------------------------------------------------
// 検品（lint）
// ---------------------------------------------------------------------------

/**
 * 使ってはいけない・注意が必要な表現（薬機法・景表法の観点での目安）。
 * 最終判断は運営側で行うこと。
 */
export const NG_EXPRESSIONS = [
  {
    pattern: /発毛|育毛|毛が生え/g,
    level: "error",
    why: "発毛・育毛の効果をうたう表現（医薬品等にあたる）",
    fix: "「頭皮環境を整える」「ボリューム感のある仕上がり」など見た目・手触りの表現にする",
  },
  {
    pattern: /治る|治す|治療|完治/g,
    level: "error",
    why: "医療行為・治療効果の表現",
    fix: "「整える」「ケアする」「扱いやすくする」",
  },
  {
    pattern: /修復|再生|蘇る|よみがえ/g,
    level: "error",
    why: "髪は「修復・再生」しないため、不当表示になりやすい",
    fix: "「補修」「ケア」「ダメージを目立ちにくくする」",
  },
  {
    pattern: /永久|半永久|一生(?!懸命)|二度と/g,
    level: "error",
    why: "持続効果の断定",
    fix: "「長く」「続きやすい」「◯か月ほどが目安」",
  },
  {
    pattern: /絶対|必ず|100%|確実に|誰でも/g,
    level: "error",
    why: "効果の断定・保証",
    fix: "「多くの場合」「〜しやすい」「〜を目指す」",
  },
  {
    pattern: /No\.?\s?1|ナンバーワン|日本一|業界初|最安|最高級/gi,
    level: "error",
    why: "根拠を示せない最上級表現",
    fix: "根拠（出典・集計方法）を示せない限り使わない",
  },
  {
    pattern: /唯一|最も(?:安い|高い|良い|人気)/g,
    level: "warn",
    why: "最上級に近い表現。根拠があるか確認",
    fix: "根拠を示すか、「数少ない」「特に」などに言い換える",
  },
  {
    pattern: /副作用(?:は)?(?:ありません|なし|ない)|安全です|安全性が高い/g,
    level: "warn",
    why: "安全性の断定",
    fix: "「刺激を抑えた薬剤を選ぶ」「事前にパッチテストを行う」など具体的な行動で表現",
  },
  {
    pattern: /アンチエイジング|若返|老化防止/g,
    level: "warn",
    why: "老化防止をうたう表現は注意が必要",
    fix: "「年齢に応じたケア」「大人の髪に合わせた」",
  },
  {
    pattern: /医師|医学的|臨床|医療/g,
    level: "warn",
    why: "医療との関連を示唆する表現",
    fix: "根拠を示す必要がある場合のみ、出典付きで使う",
  },
  {
    pattern: /満足度\s?\d+\s?%|口コミ(?:No|ナンバー)|実績\s?No/g,
    level: "warn",
    why: "根拠が必要な実績表現",
    fix: "出典・集計方法を示せない限り使わない",
  },
];

/** 空白を除いた文字数（Markdown 記号もおおまかに除く） */
export function countChars(text) {
  return text.replace(/[#*_>`\-\[\]()!|]/g, "").replace(/\s+/g, "").length;
}

function keywordTokens(keyword) {
  return String(keyword || "")
    .split(/[\s　]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** `[テキスト](URL)` 形式のリンクを集める */
export function extractLinks(body) {
  const links = [];
  const re = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(body))) {
    if (body[m.index - 1] === "!") continue; // 画像は除く
    links.push({ text: m[1], url: m[2] });
  }
  return links;
}

/**
 * 記事を検品する。
 * ctx（fetchLintContext の結果）が無ければ、美容師 ID やリンク先の存在確認は飛ばす。
 */
export function lintDraft(meta, body, ctx = null) {
  const errors = [];
  const warnings = [];
  const err = (rule, message) => errors.push({ rule, message });
  const warn = (rule, message) => warnings.push({ rule, message });

  const title = String(meta.title || "").trim();
  const keyword = String(meta.target_keyword || "").trim();
  const tokens = keywordTokens(keyword);

  // --- フロントマター
  if (!title) err("title", "title（タイトル）がありません");
  else if (title.length > TITLE_MAX) warn("title", `タイトルが ${title.length} 文字です（${TITLE_MAX} 文字以内が目安。検索結果では 30 文字前後で切れます）`);

  if (!meta.slug) err("slug", "slug（URL）がありません");
  else if (!SLUG_PATTERN.test(meta.slug)) err("slug", `slug は半角英小文字・数字・ハイフンのみ: ${meta.slug}`);
  else if (AREAS.some((a) => a.slug === meta.slug)) err("slug", `slug「${meta.slug}」はエリアの記事一覧で使っているため使えません`);

  if (!CATEGORIES.includes(meta.category)) err("category", `category は ${CATEGORIES.join(" / ")} のいずれか: ${meta.category ?? "(未設定)"}`);

  const summary = String(meta.summary || "").trim();
  if (!summary) err("summary", "summary（概要・リード文）がありません。公開に必須です");
  else if (summary.length < SUMMARY_LENGTH.min || summary.length > SUMMARY_LENGTH.max) {
    warn("summary", `summary が ${summary.length} 文字です（${SUMMARY_LENGTH.min}〜${SUMMARY_LENGTH.max} 文字が目安）`);
  }

  if (!keyword) err("target_keyword", "target_keyword（狙う検索キーワード）がありません");
  else {
    const missing = tokens.filter((t) => !title.toLowerCase().includes(t));
    if (missing.length) warn("title", `タイトルにキーワードの語が含まれていません: ${missing.join(", ")}`);
  }

  if (meta.cover_image && !/^(\/|https:\/\/)/.test(meta.cover_image)) {
    err("cover_image", `cover_image は / から始まるパスか https:// の URL: ${meta.cover_image}`);
  }

  // --- 紹介する美容師
  const ids = Array.isArray(meta.related_stylist_ids) ? meta.related_stylist_ids : [];
  if (ids.length === 0) warn("related_stylist_ids", "紹介する美容師が設定されていません（記事から予約への導線がなくなります）");
  if (ctx) {
    for (const id of ids) {
      const s = ctx.stylists.get(id);
      if (!s) err("related_stylist_ids", `美容師 ID が見つかりません: ${id}`);
      else if (!s.active) warn("related_stylist_ids", `${id}（${s.name}）は非公開のため記事には表示されません`);
    }
  }

  // --- 本文
  const text = body.trim();
  if (!text) {
    err("body", "本文がありません");
    return { errors, warnings };
  }
  if (/^#\s/m.test(text)) err("body", "本文に「# 」（H1）があります。タイトルは自動で付くので見出しは「## 」から始めてください");
  const h2 = [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  if (h2.length < 3) warn("body", `「## 」の見出しが ${h2.length} 個です（3 個以上が目安）`);
  if (/<\/?[a-z][^>]*>/i.test(text)) warn("body", "HTML タグが含まれています。Markdown だけで書いてください");
  if (/^\s*\|.*\|\s*$/m.test(text)) warn("body", "表（| 区切り）は現在のサイトでは表示されません。箇条書きに置き換えてください");

  const chars = countChars(text);
  if (chars < BODY_LENGTH.min || chars > BODY_LENGTH.max) {
    warn("body", `本文が約 ${chars} 文字です（${BODY_LENGTH.min}〜${BODY_LENGTH.max} 文字が目安）`);
  }

  // キーワードの配置
  if (tokens.length) {
    const lead = text.split(/^##\s/m)[0].toLowerCase();
    const missingLead = tokens.filter((t) => !lead.includes(t));
    if (missingLead.length) warn("keyword", `書き出し（最初の見出しより前）にキーワードの語がありません: ${missingLead.join(", ")}`);
    const inH2 = h2.some((h) => tokens.every((t) => h.toLowerCase().includes(t)));
    if (!inH2) warn("keyword", "キーワード全体を含む「## 」見出しがありません（1 つは入れるのが目安）");
  }

  // 使ってはいけない表現（タイトル・概要・本文すべてを見る）
  const everything = `${title}\n${summary}\n${text}`;
  for (const ng of NG_EXPRESSIONS) {
    const hits = [...everything.matchAll(ng.pattern)].map((m) => m[0]);
    if (!hits.length) continue;
    const uniq = [...new Set(hits)].join("、");
    const message = `「${uniq}」: ${ng.why} → ${ng.fix}`;
    if (ng.level === "error") err("expression", message);
    else warn("expression", message);
  }

  // リンク
  const links = extractLinks(text);
  const external = links.filter((l) => /^https?:\/\//.test(l.url));
  const internal = links.filter((l) => l.url.startsWith("/"));
  if (external.length > 3) warn("links", `外部リンクが ${external.length} 件あります（3 件以内が目安）`);
  for (const l of external) {
    if (l.url.startsWith("http://")) warn("links", `http:// のリンクがあります（https にできないか確認）: ${l.url}`);
  }
  for (const l of internal) {
    const [p] = l.url.split(/[?#]/);
    let m;
    if ((m = p.match(/^\/stylists\/([^/]+)$/))) {
      if (ctx) {
        const s = ctx.stylists.get(m[1]);
        if (!s) err("links", `リンク先の美容師が見つかりません: ${l.url}`);
        else if (!s.active) warn("links", `リンク先の美容師は非公開です: ${l.url}`);
      }
    } else if ((m = p.match(/^\/articles\/([^/]+)$/)) && AREAS.some((a) => a.slug === m[1])) {
      // エリアの記事一覧（/articles/omotesando など）
    } else if ((m = p.match(/^\/stores\/([^/]+)$/))) {
      if (!loadStores().some((st) => st.id === m[1])) warn("links", `リンク先の店舗が見つかりません: ${l.url}`);
    } else if ((m = p.match(/^\/articles\/([^/]+)$/))) {
      if (ctx) {
        const a = ctx.articles.get(m[1]);
        if (!a) err("links", `リンク先の記事が見つかりません: ${l.url}`);
        else if (a.status !== "published") warn("links", `リンク先の記事はまだ公開されていません: ${l.url}`);
      }
    } else if (!["/", "/stylists", "/articles", "/match"].includes(p)) {
      warn("links", `サイト内に無いページへのリンクかもしれません: ${l.url}`);
    }
  }
  if (internal.length === 0) warn("links", "サイト内リンクがありません（美容師ページや一覧への導線を入れてください）");

  // 要確認マーカー
  const todo = [...text.matchAll(/\[要確認[^\]]*\]/g)].map((m) => m[0]);
  if (todo.length) warn("review", `[要確認] が ${todo.length} 箇所あります。公開前に運営側で確認してください`);

  return { errors, warnings };
}

export function printLint({ errors, warnings }) {
  for (const e of errors) console.log(`  ✗ [${e.rule}] ${e.message}`);
  for (const w of warnings) console.log(`  ! [${w.rule}] ${w.message}`);
  if (!errors.length && !warnings.length) console.log("  ✓ 問題は見つかりませんでした");
}

// ---------------------------------------------------------------------------
// 記事の材料（文脈）: context.mjs / run.mjs / candidates.mjs で共通
// ---------------------------------------------------------------------------

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function loadStores() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stores.json"), "utf8"));
}

export function normalizeMenus(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => (typeof m === "string" ? { name: m, duration: 60 } : { name: m?.name ?? "", duration: m?.duration ?? 60 }))
    .filter((m) => m.name);
}

/**
 * 記事を書くための材料をまとめて取る。
 * stylists は掲載中のみ（記事に書いてよい公開情報）。allStylists は検品用に非公開も含む。
 */
export async function buildContext(db) {
  const stores = loadStores();
  const storeById = Object.fromEntries(stores.map((s) => [s.id, s]));
  const [stylistRows, articleRows] = await Promise.all([
    rest(
      db,
      "GET",
      "stylists?select=id,name,name_kana,profile,store_id,strengths,specialty_menus,menus,price_range,instagram_handle,booking_mode,booking_links,contract_status,featured_flag&order=id"
    ),
    rest(
      db,
      "GET",
      "articles?select=id,slug,title,summary,category,status,target_keyword,related_stylist_ids,published_at,updated_at&order=updated_at.desc"
    ),
  ]);

  const stylists = stylistRows
    .filter((s) => s.contract_status === "active")
    .map((s) => {
      const store = storeById[s.store_id];
      return {
        id: s.id,
        name: s.name,
        nameKana: s.name_kana ?? "",
        url: `${SITE_URL}/stylists/${s.id}`,
        store: store ? { id: store.id, name: store.name, area: store.area } : { id: s.store_id, name: "", area: "" },
        profile: s.profile ?? "",
        strengths: s.strengths ?? [],
        specialtyMenus: s.specialty_menus ?? [],
        menus: normalizeMenus(s.menus),
        // price_range は jsonb { min, max }（0 なら「指定なし」）
        priceRange: { min: Number(s.price_range?.min ?? 0), max: Number(s.price_range?.max ?? 0) },
        instagram: s.instagram_handle ? `https://www.instagram.com/${s.instagram_handle}/` : null,
        bookingMode: s.booking_mode ?? "external",
        hasBookingLink: (s.booking_mode ?? "external") === "pomie" || (s.booking_links ?? []).length > 0,
        featured: Boolean(s.featured_flag),
      };
    });

  const articles = articleRows.map((a) => ({
    id: a.id,
    slug: a.slug,
    url: `${SITE_URL}/articles/${a.slug}`,
    title: a.title,
    summary: a.summary,
    category: a.category,
    status: a.status,
    targetKeyword: a.target_keyword,
    relatedStylistIds: a.related_stylist_ids ?? [],
    publishedAt: a.published_at,
    updatedAt: a.updated_at,
  }));

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  return {
    generatedAt: new Date().toISOString(),
    db: db.label,
    site: SITE_URL,
    links: {
      stylistList: `${SITE_URL}/stylists`,
      stylistByMenu: `${SITE_URL}/stylists?menu={メニュー名を URL エンコード}`,
      stylistByStore: `${SITE_URL}/stylists?storeId={s1|s2}`,
      match: `${SITE_URL}/match`,
      articles: `${SITE_URL}/articles`,
    },
    stores: stores.map((s) => ({ id: s.id, name: s.name, area: s.area, catchphrase: s.catchphrase ?? "", image: s.image, gallery: s.gallery ?? [] })),
    stylists,
    allStylists: stylistRows.map((s) => ({ id: s.id, name: s.name, active: s.contract_status === "active", storeId: s.store_id })),
    articles,
    taxonomy: {
      areas: uniq(stores.map((s) => s.area)),
      menus: uniq(stylists.flatMap((s) => s.menus.map((m) => m.name))),
      specialtyMenus: uniq(stylists.flatMap((s) => s.specialtyMenus)),
      strengths: uniq(stylists.flatMap((s) => s.strengths)),
    },
  };
}

/** キーワードが既存の記事・候補と重なっていないか */
export function keywordOverlap(keyword, articles, candidates = []) {
  const tokens = String(keyword).trim().toLowerCase().split(/[\s　]+/).filter(Boolean);
  const entries = [
    ...articles.map((a) => ({ kind: "記事", slug: a.slug, title: a.title, status: a.status, keyword: a.targetKeyword ?? "" })),
    ...candidates.map((c) => ({ kind: "候補", slug: c.id, title: c.suggestedTitle ?? c.keyword, status: c.status, keyword: c.keyword })),
  ];
  const overlapping = entries
    .map((e) => {
      const hay = `${e.keyword} ${e.title}`.toLowerCase();
      return { ...e, matchedTokens: tokens.filter((t) => hay.includes(t)) };
    })
    .filter((e) => e.matchedTokens.length > 0)
    .sort((a, b) => b.matchedTokens.length - a.matchedTokens.length);
  const same = overlapping.filter((e) => e.matchedTokens.length === tokens.length);
  return {
    keyword: String(keyword).trim(),
    verdict:
      same.length > 0
        ? "既存の記事・候補と同じキーワードです。重複を避けるため、切り口を変えるか既存の更新を検討してください"
        : overlapping.length > 0
          ? "語の一部が重なる記事・候補があります。狙いが被らないか確認してください"
          : "既存の記事・候補との重なりはありません",
    sameKeyword: same,
    overlapping: overlapping.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// キーワード候補・記事の DB 操作（PostgREST）
// ---------------------------------------------------------------------------

export function rowToCandidate(row) {
  return {
    id: row.id,
    keyword: row.keyword,
    seed: row.seed ?? null,
    searchVolume: row.search_volume ?? null,
    seoDifficulty: row.seo_difficulty ?? null,
    competition: row.competition ?? null,
    cpc: row.cpc ?? null,
    intent: row.intent ?? null,
    category: row.category ?? null,
    suggestedTitle: row.suggested_title ?? null,
    angle: row.angle ?? null,
    faqQuestions: row.faq_questions ?? [],
    relatedKeywords: row.related_keywords ?? [],
    targetStylistIds: row.target_stylist_ids ?? [],
    score: row.score ?? null,
    reason: row.reason ?? null,
    status: row.status,
    note: row.note ?? null,
    articleId: row.article_id ?? null,
    error: row.error ?? null,
    proposedAt: row.proposed_at,
    decidedAt: row.decided_at ?? null,
    writtenAt: row.written_at ?? null,
    updatedAt: row.updated_at,
  };
}

export async function listCandidates(db, { status } = {}) {
  const q = status ? `&status=eq.${encodeURIComponent(status)}` : "";
  const rows = await rest(db, "GET", `keyword_candidates?select=*&order=score.desc${q}`);
  return rows.map(rowToCandidate);
}

export async function getCandidate(db, idOrKeyword) {
  const byId = await rest(db, "GET", `keyword_candidates?select=*&id=eq.${encodeURIComponent(idOrKeyword)}&limit=1`);
  if (byId[0]) return rowToCandidate(byId[0]);
  const byKw = await rest(db, "GET", `keyword_candidates?select=*&keyword=eq.${encodeURIComponent(idOrKeyword)}&limit=1`);
  return byKw[0] ? rowToCandidate(byKw[0]) : null;
}

export async function updateCandidate(db, id, patch) {
  await rest(db, "PATCH", `keyword_candidates?id=eq.${encodeURIComponent(id)}`, {
    body: { ...patch, updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
}

export async function insertCandidates(db, rows) {
  if (!rows.length) return;
  await rest(db, "POST", "keyword_candidates", { body: rows, prefer: "return=minimal" });
}

export async function listSeeds(db) {
  const rows = await rest(db, "GET", "keyword_seeds?select=*&order=created_at");
  return rows.map((r) => ({ id: r.id, keyword: r.keyword, enabled: r.enabled, note: r.note ?? null, lastUsedAt: r.last_used_at ?? null }));
}

/** 同じ slug の記事があれば -2, -3 … を付けて一意にする */
export async function ensureUniqueSlug(db, slug) {
  let candidate = slug;
  for (let i = 2; i < 50; i++) {
    const rows = await rest(db, "GET", `articles?select=id&slug=eq.${encodeURIComponent(candidate)}&limit=1`);
    if (rows.length === 0) return candidate;
    candidate = `${slug}-${i}`;
  }
  throw new Error(`slug を一意にできません: ${slug}`);
}
