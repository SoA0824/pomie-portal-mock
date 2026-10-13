/**
 * 記事を書くための材料（文脈）を JSON で出す。
 *
 *   node scripts/articles/context.mjs [--keyword "表参道 髪質改善"] [--target production|mock] [--out ファイル]
 *
 * 出力:
 *   - stores     … 店舗（名前・エリア・写真）
 *   - stylists   … 掲載中の美容師（強み・得意メニュー・予約可能メニュー・料金・所属店舗）
 *                  ※ 記事に書いてよいのは、ここに出ている＝サイトで公開済みの情報だけ
 *   - articles   … 既存の記事（公開・下書きとも）。同じキーワードで書かないための確認用
 *   - taxonomy   … メニュー・強みの一覧（キーワードの種）
 *   - keywordCheck … --keyword を渡したとき、既存記事との重なり
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, SITE_URL, loadDb, parseArgs, rest } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));

function normalizeMenus(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => (typeof m === "string" ? { name: m, duration: 60 } : { name: m?.name ?? "", duration: m?.duration ?? 60 }))
    .filter((m) => m.name);
}

async function main() {
  const db = loadDb(args.target ?? "production");
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stores.json"), "utf8"));
  const storeById = Object.fromEntries(stores.map((s) => [s.id, s]));

  const [stylistRows, articleRows] = await Promise.all([
    rest(
      db,
      "GET",
      "stylists?select=id,name,name_kana,profile,store_id,strengths,specialty_menus,menus,price_min,price_max,instagram_handle,booking_mode,booking_links,contract_status,featured_flag&order=id"
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
        priceRange: { min: s.price_min ?? 0, max: s.price_max ?? 0 },
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
  const taxonomy = {
    areas: uniq(stores.map((s) => s.area)),
    menus: uniq(stylists.flatMap((s) => s.menus.map((m) => m.name))),
    specialtyMenus: uniq(stylists.flatMap((s) => s.specialtyMenus)),
    strengths: uniq(stylists.flatMap((s) => s.strengths)),
  };

  let keywordCheck = null;
  if (typeof args.keyword === "string" && args.keyword.trim()) {
    const tokens = args.keyword.trim().toLowerCase().split(/[\s　]+/).filter(Boolean);
    const overlapping = articles
      .map((a) => {
        const hay = `${a.targetKeyword ?? ""} ${a.title}`.toLowerCase();
        const hit = tokens.filter((t) => hay.includes(t));
        return { slug: a.slug, title: a.title, status: a.status, targetKeyword: a.targetKeyword, matchedTokens: hit };
      })
      .filter((a) => a.matchedTokens.length > 0)
      .sort((a, b) => b.matchedTokens.length - a.matchedTokens.length);
    const sameKeyword = overlapping.filter((a) => a.matchedTokens.length === tokens.length);
    keywordCheck = {
      keyword: args.keyword.trim(),
      verdict:
        sameKeyword.length > 0
          ? "既存記事と同じキーワードです。重複を避けるため、切り口を変えるか既存記事の更新を検討してください"
          : overlapping.length > 0
            ? "語の一部が重なる記事があります。狙いが被らないか確認してください"
            : "既存記事との重なりはありません",
      sameKeyword,
      overlapping: overlapping.slice(0, 10),
    };
  }

  const out = {
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
    articles,
    taxonomy,
    keywordCheck,
  };

  const json = JSON.stringify(out, null, 2);
  if (typeof args.out === "string") {
    fs.writeFileSync(args.out, json);
    console.log(`書き出しました: ${args.out}（美容師 ${stylists.length} 名 / 記事 ${articles.length} 本）`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
