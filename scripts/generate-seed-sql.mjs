#!/usr/bin/env node
// data/*.json から supabase/seed.sql を生成するワンショットスクリプト
// 使い方: node scripts/generate-seed-sql.mjs > supabase/seed.sql

import { readFileSync } from "node:fs";

const stylists = JSON.parse(readFileSync("./data/stylists.json", "utf8"));
const snsPosts = JSON.parse(readFileSync("./data/snsPosts.json", "utf8"));

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;
const textArr = (arr) =>
  `ARRAY[${arr.map((s) => sql(s)).join(",")}]::text[]`;
const jsonb = (obj) => `${sql(JSON.stringify(obj))}::jsonb`;

// メニュー名 → 既定の施術時間（分）
const MENU_DURATIONS = {
  カット: 60,
  メンズカット: 60,
  ボブ: 75,
  ショート: 75,
  ロング: 75,
  カラー: 90,
  似合わせカラー: 90,
  デザインカラー: 90,
  パーソナルカラー: 90,
  トリートメント: 60,
  ヘッドスパ: 60,
  髪質改善: 120,
  縮毛矯正: 180,
  パーマ: 120,
  デジタルパーマ: 120,
  ツイストスパイラル: 120,
  コテ巻き風パーマ: 120,
  ハイライト: 150,
  バレイヤージュ: 180,
  ヘアセット: 60,
  アップスタイル: 60,
  編み込み: 60,
  ブライダル: 120,
  白髪ぼかし: 90,
};
const menusToJsonb = (names) =>
  jsonb(names.map((name) => ({ name, duration: MENU_DURATIONS[name] ?? 60 })));

const extractInstagramHandle = (snsLinks) => {
  const url = snsLinks?.instagram;
  if (!url) return null;
  const m = url.match(/instagram\.com\/([^/?#]+)/);
  return m ? m[1] : null;
};

console.log("-- 自動生成: scripts/generate-seed-sql.mjs から");
console.log("-- 適用方法: Supabase Studio の SQL Editor でこのファイル全文を Run");
console.log("");
console.log("-- ===== stylists (12 名) =====");
for (const s of stylists) {
  const handle = extractInstagramHandle(s.snsLinks);
  console.log(
    `insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (\n  ${sql(s.id)},\n  ${sql(s.name)},\n  ${sql(s.nameKana)},\n  ${sql(s.avatar)},\n  ${sql(s.profile)},\n  ${sql(s.storeId)},\n  ${sql(s.area)},\n  ${menusToJsonb(s.menus)},\n  ${jsonb(s.priceRange)},\n  ${textArr(s.availableTimeSlots)},\n  ${handle ? sql(handle) : "null"},\n  ${jsonb(s.snsLinks ?? {})},\n  ${sql(s.contractStatus)},\n  ${s.featuredFlag},\n  ${s.rating},\n  ${s.worksCount}\n) on conflict (id) do nothing;`
  );
}

console.log("");
console.log(`-- ===== sns_posts (${snsPosts.length} 件) =====`);
for (const p of snsPosts) {
  console.log(
    `insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (\n  ${sql(p.id)},\n  ${sql(p.stylistId)},\n  ${sql(p.platform)},\n  ${sql(p.imageUrl)},\n  ${sql(p.caption)},\n  ${sql(p.postedAt)},\n  ${sql(p.id)}\n) on conflict (id) do nothing;`
  );
}
