/**
 * キーワード候補の選別とスコアリング。
 *
 * コネクタ経路（Claude Code）とサーバー経路（run.mjs propose）の両方で同じ基準を使うため、
 * ここに集約する。基準は docs/ARTICLE-GUIDELINES.md 2 章に合わせる。
 */

/** 記事にしないキーワード（他社の求人・口コミ・テレビ・DIY など） */
export const EXCLUDE_PATTERN =
  /マツコ|ホットペッパー|hotpepper|求人|採用|バイト|アルバイト|年収|給料|口コミ|レビュー|評判|炎上|楽天|amazon|市販|セルフ|自宅|自分で|やり方|100均|ドンキ|通販|動画|youtube|写真|画像|メニュー表|営業時間|電話/i;

/** 3 文字以上の英字（他サロンのブランド名であることが多い） */
const BRANDISH_PATTERN = /[A-Za-z]{3,}/;

const BOOKING_PATTERN = /美容院|美容室|サロン|おすすめ|人気|上手|うまい|料金|値段|相場|安い|予約|専門店|専門/;
const COMPARE_PATTERN = /違い|比較|どっち|どちら|選び方|メリット|デメリット|失敗|後悔|向いて/;

/**
 * 検索意図を推定する。
 *   booking: 予約に近い / compare: 比較・検討 / info: 情報収集
 */
export function classifyIntent(keyword) {
  if (BOOKING_PATTERN.test(keyword)) return "booking";
  if (COMPARE_PATTERN.test(keyword)) return "compare";
  return "info";
}

function tokens(keyword) {
  return String(keyword)
    .toLowerCase()
    .split(/[\s　]+/)
    .filter(Boolean);
}

/**
 * キーワードに対応できる美容師を探す。
 * メニュー・得意メニュー・強みのいずれかが含まれ、かつエリアが合う（または指定なし）美容師を返す。
 */
export function matchStylists(keyword, stylists) {
  const kw = String(keyword).toLowerCase();
  const scored = stylists
    .map((s) => {
      const terms = [
        ...s.menus.map((m) => m.name),
        ...s.specialtyMenus,
        ...s.strengths,
      ].map((t) => String(t).toLowerCase());
      const termHit = terms.some((t) => t && (kw.includes(t) || t.includes(kw.replace(/[\s　].*/, ""))));
      const areaHit = s.store?.area ? kw.includes(String(s.store.area).toLowerCase()) : false;
      const areaMentioned = /表参道|恵比寿|渋谷|青山|原宿|代官山|中目黒/.test(kw);
      // エリアが書かれているのに別エリアの美容師なら対象外
      if (areaMentioned && !areaHit) return null;
      const score = (termHit ? 2 : 0) + (areaHit ? 1 : 0);
      return score > 0 ? { id: s.id, score, termHit, areaHit } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * 候補を評価する。score は 0〜100。skip が true なら候補にしない。
 */
export function evaluateKeyword(item, { stylists = [], existingKeywords = new Set(), areas = [] } = {}) {
  const keyword = item.keyword.trim().replace(/\s+/g, " ");
  const reasons = [];
  let skip = null;

  if (!keyword || tokens(keyword).length === 0) skip = "空のキーワード";
  else if (EXCLUDE_PATTERN.test(keyword)) skip = "記事の対象外（求人・口コミ・テレビ・DIY など）";
  else if (BRANDISH_PATTERN.test(keyword)) skip = "他サロンの店名を含む可能性";
  else if (existingKeywords.has(keyword.toLowerCase())) skip = "既に候補または記事がある";
  else if (item.searchVolume !== null && item.searchVolume < 10) skip = "検索数がほぼ無い";

  const intent = classifyIntent(keyword);
  const matches = matchStylists(keyword, stylists);
  const vol = item.searchVolume;
  const diff = item.seoDifficulty;

  let volScore;
  if (vol === null) volScore = 0.35;
  else if (vol >= 100 && vol <= 3000) volScore = 1;
  else if (vol > 3000) volScore = 0.6;
  else if (vol >= 30) volScore = 0.55;
  else volScore = 0.25;

  let diffScore;
  if (diff === null) diffScore = 0.6;
  else if (diff <= 33) diffScore = 1;
  else if (diff <= 50) diffScore = 0.75;
  else if (diff <= 66) diffScore = 0.45;
  else diffScore = 0.15;

  const intentScore = intent === "booking" ? 1 : intent === "compare" ? 0.8 : 0.5;
  const areaMentioned = areas.some((a) => keyword.includes(a));
  const matchScore = matches.some((m) => m.termHit && m.areaHit)
    ? 1
    : matches.some((m) => m.termHit)
      ? 0.8
      : areaMentioned
        ? 0.5
        : 0.3;
  if (matches.length === 0) reasons.push("対応できる美容師が見つからない");

  const score = Math.round(100 * (0.35 * volScore + 0.25 * diffScore + 0.2 * intentScore + 0.2 * matchScore));

  if (vol !== null && vol >= 100 && vol <= 3000) reasons.push("検索数が立ち上げ期に合う規模");
  if (diff !== null && diff <= 40) reasons.push("難易度が低め");
  if (intent === "booking") reasons.push("予約に近い検索意図");
  if (matches.some((m) => m.termHit && m.areaHit)) reasons.push("エリアとメニューが合う美容師がいる");

  return {
    keyword,
    intent,
    score,
    skip,
    targetStylistIds: matches.slice(0, 3).map((m) => m.id),
    reason: reasons.join("・"),
  };
}

/** 記事カテゴリを推定する（企画段階の既定値。執筆時に変えてよい） */
export function guessCategory(keyword) {
  if (/メンズ|男性|男の/.test(keyword)) return "メンズ";
  if (/カラー|ハイライト|バレイヤージュ|白髪|ブリーチ|インナーカラー|グレイ/.test(keyword)) return "カラー";
  if (/カット|ボブ|ショート|ロング|前髪|レイヤー|髪型/.test(keyword)) return "カット";
  if (/髪質改善|縮毛|トリートメント|ヘッドスパ|パーマ|ダメージ|くせ毛|うねり|広がり|艶|ツヤ/.test(keyword)) return "ケア";
  if (/表参道|恵比寿|渋谷|青山|原宿|代官山/.test(keyword)) return "エリア";
  return "ケア";
}

/** Claude を使わないときの簡易な企画案（タイトル案・切り口） */
export function heuristicPlan(keyword, intent) {
  const base = keyword.replace(/\s+/g, " ");
  if (intent === "booking") {
    return {
      title: `${base}｜失敗しない美容師の選び方と料金の目安`,
      angle: "検索した人が「どの美容師に頼めばいいか」を決められるよう、選び方の基準・料金目安・ポミエの対応できる美容師をつなぐ",
    };
  }
  if (intent === "compare") {
    return {
      title: `${base}。迷ったときの判断ポイント`,
      angle: "比較・検討中の人向けに違いを整理し、髪の状態別にどちらが向くかを示して、相談先として美容師を紹介する",
    };
  }
  return {
    title: `${base}とは？知っておきたい基礎と美容師への相談のしかた`,
    angle: "基礎知識を短く整理したうえで、実際に施術を受けるときの選び方へ誘導し、対応できる美容師を紹介する",
  };
}

/**
 * 美容師データから種キーワードを自動生成する（エリア × 得意メニュー）。
 */
export function generateSeeds(stylists, stores) {
  const seeds = new Set();
  for (const s of stylists) {
    const area = s.store?.area;
    const menus = [...s.specialtyMenus, ...s.menus.map((m) => m.name)].filter(Boolean);
    for (const m of menus) {
      if (area) seeds.add(`${area} ${m}`);
    }
  }
  for (const st of stores) {
    if (st.area) seeds.add(`${st.area} 美容院`);
  }
  return Array.from(seeds);
}
