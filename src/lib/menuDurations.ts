/**
 * メニュー名から既定の施術時間（分）を引くマップ。
 * 美容師登録時に時間が未入力なら、ここから引いて補完する。
 */
export const DEFAULT_MENU_DURATIONS: Record<string, number> = {
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

export const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 210, 240];

export function getDefaultDuration(menuName: string): number {
  return DEFAULT_MENU_DURATIONS[menuName.trim()] ?? 60;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
