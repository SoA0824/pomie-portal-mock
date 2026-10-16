/**
 * 記事のエリア（タグ）。
 * エリア一覧ページ /articles/{slug} の URL と、記事・店舗の対応をここで管理する。
 *
 * 注意: slug は記事の URL（/articles/{記事の slug}）と同じ階層に並ぶため、
 * 記事の slug には使えない（保存時に弾く）。scripts/articles/lib.mjs の AREAS とそろえること。
 */
export type Area = {
  /** URL に使う英字（/articles/omotesando） */
  slug: string;
  /** 表示名（キーワードの判定にも使う） */
  name: string;
  /** このエリアの店舗 */
  storeIds: string[];
  /** 一覧ページの紹介文 */
  description: string;
};

export const AREAS: Area[] = [
  {
    slug: "omotesando",
    name: "表参道",
    storeIds: ["s1"],
    description:
      "表参道で美容室・美容師を探している方へ。髪の悩みやメニュー選び、美容師の選び方を、ポミエ 表参道の美容師情報とあわせて紹介します。",
  },
  {
    slug: "ebisu",
    name: "恵比寿",
    storeIds: ["s2"],
    description:
      "恵比寿で美容室・美容師を探している方へ。髪の悩みやメニュー選び、美容師の選び方を、ポミエ 恵比寿の美容師情報とあわせて紹介します。",
  },
];

export const AREA_SLUGS = AREAS.map((a) => a.slug);

export function getAreaBySlug(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

/** 記事の slug に使えない値（エリア一覧と URL がぶつかるため） */
export function isReservedArticleSlug(slug: string): boolean {
  return AREA_SLUGS.includes(slug);
}

/** テキスト（キーワード・タイトル）に含まれるエリアを推定する */
export function detectAreas(...texts: Array<string | null | undefined>): string[] {
  const hay = texts.filter(Boolean).join(" ");
  return AREAS.filter((a) => hay.includes(a.name)).map((a) => a.slug);
}
