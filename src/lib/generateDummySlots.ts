/**
 * ダミーの予約可能枠を生成する。
 *
 * - 翌日〜10 日先までの平日朝〜夕方の中から `count` 個をランダム選択
 * - 同じ stylist id に対しては同じスロット（決定論的）
 * - 形式は既存データに合わせて "YYYY-MM-DDTHH:00"（タイムゾーン無し）
 */

const HOURS = [10, 11, 13, 14, 15, 16, 17, 18]; // 12時はランチで除外
const DAYS_AHEAD = 10;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function generateDummyAvailableSlots(seed: string, count = 8): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 候補スロットを全部列挙
  const candidates: { day: number; hour: number }[] = [];
  for (let d = 1; d <= DAYS_AHEAD; d++) {
    for (const hr of HOURS) {
      candidates.push({ day: d, hour: hr });
    }
  }

  // seed ベースの LCG で Fisher-Yates シャッフル（同じ seed なら同じ結果）
  let h = hashStr(seed) || 1;
  for (let i = candidates.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // 先頭 count 件を取って時系列ソート
  const picked = candidates.slice(0, count).sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.hour - b.hour
  );

  return picked.map((p) => {
    const d = new Date(today);
    d.setDate(d.getDate() + p.day);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(p.hour)}:00`;
  });
}
