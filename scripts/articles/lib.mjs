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
    const hint = /relation .* does not exist|Could not find the table/.test(msg)
      ? "\n  記事テーブルが未作成の可能性があります。Supabase の SQL Editor で supabase/migration-008-articles.sql を実行してください。"
      : "";
    throw new Error(`Supabase ${method} ${pathAndQuery.split("?")[0]} → HTTP ${res.status}: ${msg}${hint}`);
  }
  return data;
}

/** 記事の検品・保存に使う最小限の文脈（美容師 / 記事一覧）を取る */
export async function fetchLintContext(db) {
  const [stylists, articles] = await Promise.all([
    rest(db, "GET", "stylists?select=id,name,contract_status&order=id"),
    rest(db, "GET", "articles?select=id,slug,title,status,target_keyword"),
  ]);
  return {
    stylists: new Map(stylists.map((s) => [s.id, { name: s.name, active: s.contract_status === "active" }])),
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
