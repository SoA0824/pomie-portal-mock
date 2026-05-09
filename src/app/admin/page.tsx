import Link from "next/link";
import { listReservations } from "@/lib/data/reservations";
import { getAllArticles } from "@/lib/data/articles";
import { getAllPublishedStylists } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理ダッシュボード | POMiE Portal" };

export default async function AdminDashboard() {
  const reservations = await listReservations();
  const stylists = getAllPublishedStylists();
  const articles = getAllArticles();
  const stores = getAllStores();
  const today = new Date().toISOString().slice(0, 10);
  const todayReservations = reservations.filter((r) => r.desiredDateTime.startsWith(today));
  const sbFailed = reservations.filter((r) => r.salonboard.status === "failed").length;

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="mt-1 text-sm text-ink-500">運用に必要な数字をひと目で確認できます。</p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="予約件数（累計）" value={reservations.length.toString()} />
        <Stat label="本日の予約" value={todayReservations.length.toString()} />
        <Stat label="掲載中の美容師" value={stylists.length.toString()} suffix="名" />
        <Stat label="店舗数" value={stores.length.toString()} suffix="店" />
        <Stat label="記事数" value={articles.length.toString()} />
        <Stat label="サロンボード連携 失敗" value={sbFailed.toString()} suffix="件" tone={sbFailed > 0 ? "alert" : "default"} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold">直近の予約</h2>
        <Link href="/admin/reservations" className="text-xs text-pomie-600 hover:underline">
          すべて見る →
        </Link>
        <div className="mt-3 card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pomie-100/50 text-xs uppercase tracking-wider text-pomie-700">
              <tr>
                <th className="px-3 py-2 text-left">予約ID</th>
                <th className="px-3 py-2 text-left">日時</th>
                <th className="px-3 py-2 text-left">お客様</th>
                <th className="px-3 py-2 text-left">チャネル</th>
                <th className="px-3 py-2 text-left">SB状態</th>
              </tr>
            </thead>
            <tbody>
              {reservations.slice(-5).reverse().map((r) => (
                <tr key={r.id} className="border-t border-ink-100/70">
                  <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2">{r.desiredDateTime}</td>
                  <td className="px-3 py-2">{r.customerName}</td>
                  <td className="px-3 py-2">
                    <span className="chip">{r.channel}</span>
                  </td>
                  <td className="px-3 py-2">
                    <SbBadge status={r.salonboard.status} />
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-500">
                    まだ予約がありません。Web または LINE Bot モックから予約してみてください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone = "default",
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "default" | "alert";
}) {
  return (
    <div className={`card p-4 ${tone === "alert" ? "ring-2 ring-amber-300" : ""}`}>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-ink-500">{suffix}</span>}
      </p>
    </div>
  );
}

function SbBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    reserved: "bg-green-100 text-green-800",
    pending: "bg-amber-100 text-amber-800",
    unavailable: "bg-red-100 text-red-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status] ?? "bg-ink-100"}`}>
      {status}
    </span>
  );
}
