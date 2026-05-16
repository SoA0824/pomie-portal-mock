export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  const week = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${yyyy}/${mm}/${dd}(${week}) ${hh}:${mi}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mi}`;
}

export function formatPriceRange(min: number, max: number): string {
  return `¥${min.toLocaleString()}〜¥${max.toLocaleString()}`;
}

export function addMinutes(iso: string, minutes: number): Date {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/** "10:00 〜 13:00" 形式で時間帯を返す */
export function formatTimeRange(startIso: string, durationMin: number): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  const end = addMinutes(startIso, durationMin);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${pad(start.getHours())}:${pad(start.getMinutes())} 〜 ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}
