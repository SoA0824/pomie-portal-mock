import type { Stylist } from "./types";

export type Selections = {
  wishes: string[]; // 主な希望（メニュー系）
  concerns: string[]; // お悩み・テイスト（強み系）
  area?: string | null;
  budgetMax?: number | null;
};

export type MatchResult = {
  stylist: Stylist;
  score: number;
  matchedStrengths: string[];
  matchedSpecialty: string[];
  matchedMenus: string[];
  reasons: string[];
};

/**
 * 質問定義: 「主な希望」(メニュー系)
 * key: 表示ラベル
 * labels: マッチ判定に使う stylist 側のメニュー名候補
 */
export const WISH_OPTIONS: Array<{ key: string; labels: string[] }> = [
  { key: "髪質改善", labels: ["髪質改善", "縮毛矯正", "トリートメント"] },
  {
    key: "カラーを変えたい",
    labels: [
      "カラー",
      "似合わせカラー",
      "デザインカラー",
      "パーソナルカラー",
      "ハイライト",
      "バレイヤージュ",
      "白髪ぼかし",
    ],
  },
  {
    key: "カットを変えたい",
    labels: ["カット", "ボブ", "ショート", "ロング"],
  },
  { key: "メンズスタイル", labels: ["メンズカット"] },
  {
    key: "ブライダル・ヘアセット",
    labels: ["ブライダル", "ヘアセット", "アップスタイル", "編み込み"],
  },
  {
    key: "パーマ",
    labels: ["パーマ", "デジタルパーマ", "ツイストスパイラル", "コテ巻き風パーマ"],
  },
  { key: "トリートメント・スパ", labels: ["トリートメント", "ヘッドスパ"] },
];

/**
 * 質問定義: 「お悩み・希望テイスト」(強み系)
 * key: 表示ラベル
 * strengths: マッチ判定に使う stylist 側の強み候補
 */
export const CONCERN_OPTIONS: Array<{ key: string; strengths: string[] }> = [
  {
    key: "ダメージケア重視",
    strengths: ["ダメージレス施術", "髪質改善のプロ", "頭皮ケア・スパ"],
  },
  {
    key: "似合うものを提案してほしい",
    strengths: ["似合わせカット", "顔タイプ診断対応"],
  },
  { key: "ナチュラル系", strengths: ["ナチュラル系"] },
  { key: "韓国スタイル", strengths: ["韓国スタイル"] },
  {
    key: "ハイトーンに挑戦したい",
    strengths: ["ハイトーンカラー得意", "外国人風カラー"],
  },
  { key: "大人の上品さ", strengths: ["30〜40代女性に人気"] },
  {
    key: "朝の時短スタイル",
    strengths: ["扱いやすい仕上がり", "再現性重視"],
  },
  { key: "白髪ぼかし", strengths: ["白髪ぼかし"] },
];

export const AREA_OPTIONS = ["表参道", "恵比寿"];
export const BUDGET_OPTIONS = [10000, 15000, 20000, 30000];

/**
 * スコアリング:
 * - メニュー一致: +3 per match (重複なし)
 * - 表示用得意メニュー一致: +2 per match
 * - 強み一致: +4 per match (お悩みに合致する強みは特に重要)
 * - エリア指定: 一致で +2, 不一致で -2 (ソフトペナルティ)
 * - 予算指定: 最低料金が予算超過なら disqualified
 * - 注目フラグ: +1
 * - 評価: +rating * 0.5
 */
export function matchStylists(
  stylists: Stylist[],
  sel: Selections
): MatchResult[] {
  const candidates: MatchResult[] = stylists.map((s) => {
    const matchedStrengths = new Set<string>();
    const matchedSpecialty = new Set<string>();
    const matchedMenus = new Set<string>();
    const reasonsSet = new Set<string>();
    let score = 0;

    // wishes → menus / specialtyMenus
    for (const w of sel.wishes) {
      const wishDef = WISH_OPTIONS.find((o) => o.key === w);
      const labels = wishDef?.labels ?? [w];

      const hitMenus = s.menus.filter((m) =>
        labels.some((l) => m.name.includes(l) || l.includes(m.name))
      );
      const hitSpecialty = s.specialtyMenus.filter((sm) =>
        labels.some((l) => sm.includes(l) || l.includes(sm))
      );

      if (hitMenus.length > 0) {
        score += 3 * hitMenus.length;
        hitMenus.forEach((m) => matchedMenus.add(m.name));
      }
      if (hitSpecialty.length > 0) {
        score += 2 * hitSpecialty.length;
        hitSpecialty.forEach((sm) => matchedSpecialty.add(sm));
      }
      if (hitMenus.length > 0 || hitSpecialty.length > 0) {
        reasonsSet.add(`「${w}」対応`);
      }
    }

    // concerns → strengths
    for (const c of sel.concerns) {
      const concernDef = CONCERN_OPTIONS.find((o) => o.key === c);
      const targets = concernDef?.strengths ?? [c];
      const hit = s.strengths.filter((st) =>
        targets.some((t) => st.includes(t) || t.includes(st))
      );
      if (hit.length > 0) {
        score += 4 * hit.length;
        hit.forEach((h) => matchedStrengths.add(h));
        reasonsSet.add(`✦ ${c}にぴったり`);
      }
    }

    // area
    if (sel.area) {
      if (s.area === sel.area) {
        score += 2;
        reasonsSet.add(`${sel.area}エリア`);
      } else {
        score -= 2;
      }
    }

    // budget (hard disqualify)
    let disqualified = false;
    if (sel.budgetMax && s.priceRange.min > sel.budgetMax) {
      disqualified = true;
    }

    if (s.featuredFlag) score += 1;
    score += s.rating * 0.5;

    return {
      stylist: s,
      score: disqualified ? -1 : score,
      matchedStrengths: Array.from(matchedStrengths),
      matchedSpecialty: Array.from(matchedSpecialty),
      matchedMenus: Array.from(matchedMenus),
      reasons: Array.from(reasonsSet),
    };
  });

  return candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}
