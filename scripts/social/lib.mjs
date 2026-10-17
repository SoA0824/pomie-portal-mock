/**
 * SNS 投稿の共通処理（scripts/social/*）。
 * 文字のルールは src/lib/social/text.ts と同じにしておくこと（画面側の表示と揃える）。
 */
import fs from "node:fs";
import path from "node:path";
import { AREAS, NG_EXPRESSIONS, ROOT, SITE_URL, loadStores, parseEnvFile, rest } from "../articles/lib.mjs";

export { ROOT, SITE_URL };
export const PLANS_DIR = path.join(ROOT, "content", "social");
export const BUCKET = "social-images";

export const BRAND_TAGS = ["pomie", "ポミエ"];
export const FIXED_TAGS = ["シェアサロン", "フリーランス美容師", "美容師独立"];
export const HASHTAG_MAX = 30;
export const HASHTAG_RECOMMENDED = { min: 8, max: 20 };
export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const INSTAGRAM_CAPTION_RECOMMENDED = { min: 200, max: 800 };
export const X_WEIGHT_LIMIT = 280;
export const SLIDE_LIMITS = { min: 3, max: 8, headline: 28, headlineHard: 40, body: 70, bodyHard: 110 };
export const KINDS = ["cover", "point", "cta"];
export const SOURCES = ["none", "ai", "store", "upload"];
export const TEMPLATES = ["photo", "cream"];

/** 環境変数 → .env.production.local の順で秘密情報を探す */
export function loadSecret(name) {
  if (process.env[name]) return process.env[name];
  return parseEnvFile(path.join(ROOT, ".env.production.local"))[name] || "";
}

export function areaNames(slugs) {
  return (slugs ?? []).map((s) => AREAS.find((a) => a.slug === s)?.name).filter(Boolean);
}

/** いつも付けるタグ: #pomie #ポミエ #pomie表参道 #ポミエ表参道 #シェアサロン #フリーランス美容師 #美容師独立 */
export function requiredHashtags(areaSlugs) {
  const names = areaNames(areaSlugs);
  return [...BRAND_TAGS, ...names.flatMap((n) => BRAND_TAGS.map((b) => `${b}${n}`)), ...FIXED_TAGS];
}

export function normalizeTag(tag) {
  return String(tag).trim().replace(/^[#＃]+/, "").replace(/[\s　]+/g, "");
}

export function parseTags(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[\s　,、]+/);
  const out = [];
  for (const raw of list) {
    const t = normalizeTag(raw);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

const URL_RE = /https?:\/\/[^\s]+/g;

/** X の重み付き文字数（全角・絵文字 2、半角 1、URL は 23） */
export function xWeightedLength(text) {
  let total = 0;
  const rest = String(text ?? "").replace(URL_RE, () => {
    total += 23;
    return "";
  });
  for (const ch of rest) total += (ch.codePointAt(0) ?? 0) <= 0x10ff ? 1 : 2;
  return total;
}

export function articleUrlForX(slug) {
  return `${SITE_URL}/articles/${slug}?utm_source=x&utm_medium=social&utm_campaign=${encodeURIComponent(slug)}`;
}

export function adminUrl(postId) {
  return `${SITE_URL}/admin/social/${postId}`;
}

// ---------------------------------------------------------------------------
// DB / Storage
// ---------------------------------------------------------------------------

export async function getPost(db, id) {
  const [post] = await rest(db, "GET", `social_posts?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!post) throw new Error(`SNS 投稿が見つかりません: ${id}`);
  return post;
}

export async function getArticle(db, slugOrId) {
  const q = (col) => `articles?select=*&${col}=eq.${encodeURIComponent(slugOrId)}&limit=1`;
  const [byId] = await rest(db, "GET", q("id"));
  if (byId) return byId;
  const [bySlug] = await rest(db, "GET", q("slug"));
  if (bySlug) return bySlug;
  throw new Error(`記事が見つかりません: ${slugOrId}`);
}

export async function patchPost(db, id, body) {
  await rest(db, "PATCH", `social_posts?id=eq.${encodeURIComponent(id)}`, {
    body: { ...body, updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
}

export async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`画像を取得できません（${res.status}）: ${url}`);
  const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
  return { bytes: Buffer.from(await res.arrayBuffer()), mime };
}

/** Storage（公開バケット）にアップロードして公開 URL を返す */
export async function uploadImage(db, objectPath, bytes, mime) {
  const res = await fetch(`${db.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: db.key,
      Authorization: `Bearer ${db.key}`,
      "Content-Type": mime,
      "x-upsert": "true",
      "cache-control": "31536000",
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    const hint = /Bucket not found|bucket/i.test(text) ? "\n  画像の保存先（social-images バケット）がありません。supabase/migration-013-social-posts.sql を実行してください。" : "";
    throw new Error(`画像の保存に失敗しました（HTTP ${res.status}）: ${text.slice(0, 200)}${hint}`);
  }
  return `${db.url}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

export function absoluteUrl(p) {
  if (!p) return null;
  if (/^https?:\/\//.test(p)) return p;
  return `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
}

export function storePhotos(areaSlugs) {
  const names = new Set(areaNames(areaSlugs));
  const stores = loadStores().filter((s) => names.size === 0 || names.has(s.area));
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    area: s.area,
    catchphrase: s.catchphrase ?? "",
    description: s.description ?? "",
    photos: [...new Set([s.image, ...(s.gallery ?? [])].filter(Boolean))],
  }));
}

// ---------------------------------------------------------------------------
// 企画ファイル（content/social/<post_id>.json）
// ---------------------------------------------------------------------------

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

/**
 * Claude が書いた企画 JSON を DB に入れる形に整える。
 * slides[].image は { source, prompt, url } でも、image_source / image_prompt / image_url でもよい。
 */
export function normalizePlan(raw, { article, post }) {
  const plan = raw && typeof raw === "object" ? raw : {};
  const slidesRaw = Array.isArray(plan.slides) ? plan.slides : [];
  const slides = slidesRaw.map((s, i) => {
    const r = s && typeof s === "object" ? s : {};
    const img = r.image && typeof r.image === "object" ? r.image : {};
    let source = str(img.source ?? r.image_source ?? r.imageSource).trim();
    const url = str(img.url ?? r.image_url ?? r.imageUrl).trim() || null;
    if (!SOURCES.includes(source)) source = url ? "store" : "none";
    const template = str(r.template).trim();
    const kind = str(r.kind).trim();
    return {
      kind: KINDS.includes(kind) ? kind : i === 0 ? "cover" : i === slidesRaw.length - 1 ? "cta" : "point",
      headline: str(r.headline).trim(),
      body: str(r.body).trim(),
      image_source: source,
      image_prompt: str(img.prompt ?? r.image_prompt ?? r.imagePrompt).trim() || null,
      image_url: source === "none" ? null : url,
      template: TEMPLATES.includes(template) ? template : null,
    };
  });
  const platforms = post.platforms ?? ["instagram", "x"];
  let xReply = str(plan.x_reply ?? plan.xReply).trim();
  if (platforms.includes("x") && xReply && !/https?:\/\//.test(xReply)) xReply = `${xReply}\n${articleUrlForX(article.slug)}`;
  if (platforms.includes("x") && !xReply) xReply = `記事はこちら\n${articleUrlForX(article.slug)}`;
  const template = str(plan.template).trim();
  return {
    caption: str(plan.caption).trim(),
    hashtags: parseTags(plan.hashtags),
    alt_text: str(plan.alt_text ?? plan.altText).trim(),
    x_text: str(plan.x_text ?? plan.xText).trim(),
    x_reply: xReply,
    template: TEMPLATES.includes(template) ? template : "photo",
    slides,
  };
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

/** 企画の検品 */
export function lintPlan(plan, { article, post, lintCtx }) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const platforms = post.platforms ?? ["instagram", "x"];

  // スライド
  if (plan.slides.length < 1) err("スライドがありません");
  else if (plan.slides.length < SLIDE_LIMITS.min) warn(`スライドが ${plan.slides.length} 枚です（${SLIDE_LIMITS.min}〜5 枚が目安）`);
  if (plan.slides.length > SLIDE_LIMITS.max) err(`スライドは ${SLIDE_LIMITS.max} 枚までです`);
  plan.slides.forEach((s, i) => {
    const n = i + 1;
    if (!s.headline) err(`スライド ${n}: 見出しがありません`);
    else if (s.headline.length > SLIDE_LIMITS.headlineHard) err(`スライド ${n}: 見出しが ${s.headline.length} 文字です（${SLIDE_LIMITS.headlineHard} 文字まで）`);
    else if (s.headline.length > SLIDE_LIMITS.headline) warn(`スライド ${n}: 見出しが ${s.headline.length} 文字です（${SLIDE_LIMITS.headline} 文字以内が目安）`);
    if (s.body.length > SLIDE_LIMITS.bodyHard) err(`スライド ${n}: 本文が ${s.body.length} 文字です（${SLIDE_LIMITS.bodyHard} 文字まで）`);
    else if (s.body.length > SLIDE_LIMITS.body) warn(`スライド ${n}: 本文が ${s.body.length} 文字です（${SLIDE_LIMITS.body} 文字以内が目安）`);
    if (EMOJI_RE.test(`${s.headline}${s.body}`)) err(`スライド ${n}: 文字に絵文字は使えません（画像にしたときに表示されません）`);
    if (s.image_source === "ai" && !s.image_prompt && !s.image_url) err(`スライド ${n}: AI 画像の指示（image.prompt）がありません`);
    if ((s.image_source === "store" || s.image_source === "upload") && !s.image_url) err(`スライド ${n}: 画像の URL がありません`);
    if (s.image_source === "store" && s.image_url && !loadStores().some((st) => [st.image, ...(st.gallery ?? [])].includes(s.image_url))) {
      warn(`スライド ${n}: 店舗写真のパスが data/stores.json にありません: ${s.image_url}`);
    }
  });
  if (plan.slides.length && plan.slides[0].kind !== "cover") warn("1 枚目は表紙（cover）にしてください");
  const aiCount = plan.slides.filter((s) => s.image_source === "ai").length;
  if (aiCount > 3) warn(`AI 画像が ${aiCount} 枚あります（費用を抑えるため 1〜2 枚が目安）`);

  // Instagram
  if (platforms.includes("instagram")) {
    if (!plan.caption) err("Instagram の本文（caption）がありません");
    else {
      if (plan.caption.length > INSTAGRAM_CAPTION_LIMIT) err(`Instagram の本文が ${plan.caption.length} 文字です（${INSTAGRAM_CAPTION_LIMIT} 文字まで）`);
      else if (plan.caption.length < INSTAGRAM_CAPTION_RECOMMENDED.min || plan.caption.length > INSTAGRAM_CAPTION_RECOMMENDED.max) {
        warn(`Instagram の本文が ${plan.caption.length} 文字です（${INSTAGRAM_CAPTION_RECOMMENDED.min}〜${INSTAGRAM_CAPTION_RECOMMENDED.max} 文字が目安）`);
      }
      if (/https?:\/\//.test(plan.caption)) warn("Instagram の本文に URL があります（押せないので「プロフィールのリンクから」に）");
      if (/#/.test(plan.caption)) warn("Instagram の本文に # があります（ハッシュタグは hashtags に分けてください）");
    }
    if (plan.hashtags.length > HASHTAG_MAX) err(`ハッシュタグが ${plan.hashtags.length} 個です（${HASHTAG_MAX} 個まで）`);
    else if (plan.hashtags.length < HASHTAG_RECOMMENDED.min || plan.hashtags.length > HASHTAG_RECOMMENDED.max) {
      warn(`ハッシュタグが ${plan.hashtags.length} 個です（${HASHTAG_RECOMMENDED.min}〜${HASHTAG_RECOMMENDED.max} 個が目安）`);
    }
    const missing = requiredHashtags(article.areas ?? []).filter((t) => !plan.hashtags.includes(t));
    if (missing.length) err(`いつも付けるハッシュタグが足りません: ${missing.map((t) => `#${t}`).join(" ")}`);
    if (!plan.alt_text) warn("画像の代替テキスト（alt_text）がありません");
  }

  // X
  if (platforms.includes("x")) {
    if (!plan.x_text) err("X の本文（x_text）がありません");
    else {
      const len = xWeightedLength(plan.x_text);
      if (len > X_WEIGHT_LIMIT) err(`X の本文が長すぎます（日本語換算 ${Math.ceil(len / 2)} 文字。${X_WEIGHT_LIMIT / 2} 文字まで）`);
      if (/https?:\/\//.test(plan.x_text)) warn("X の本文に URL があります（リンクは返信に載せる方針です）");
    }
    const rlen = xWeightedLength(plan.x_reply);
    if (rlen > X_WEIGHT_LIMIT) err(`X の返信が長すぎます（日本語換算 ${Math.ceil(rlen / 2)} 文字）`);
  }

  // 表現（記事と同じ NG 表現）
  const everything = [plan.caption, plan.x_text, plan.x_reply, plan.alt_text, ...plan.slides.flatMap((s) => [s.headline, s.body])].join("\n");
  for (const ng of NG_EXPRESSIONS) {
    const hits = [...everything.matchAll(ng.pattern)].map((m) => m[0]);
    if (!hits.length) continue;
    const message = `「${[...new Set(hits)].join("、")}」: ${ng.why} → ${ng.fix}`;
    if (ng.level === "error") err(message);
    else warn(message);
  }
  const todo = everything.match(/\[要確認[^\]]*\]/g) ?? [];
  if (todo.length) warn(`[要確認] が ${todo.length} 箇所あります。投稿前に運営側で確認してください`);

  // 非公開の美容師の名前
  if (lintCtx) {
    for (const [id, s] of lintCtx.stylists) {
      if (!s.active && s.name && everything.includes(s.name)) warn(`非公開の美容師「${s.name}」（${id}）の名前が入っています`);
    }
  }
  return { errors, warnings };
}

export function printLint({ errors, warnings }) {
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warnings) console.log(`  ! ${w}`);
  if (!errors.length && !warnings.length) console.log("  ✓ 問題は見つかりませんでした");
}

export function readJson(file) {
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) throw new Error(`ファイルが見つかりません: ${abs}`);
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    throw new Error(`JSON として読めません（${abs}）: ${err.message}`);
  }
}
