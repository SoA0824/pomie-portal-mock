import { listReservations } from "@/lib/data/reservations";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "予約一覧 | 管理 | POMiE Portal" };

export default async function AdminReservationsPage() {
  const reservations = (await listReservations()).slice().reverse();

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">予約一覧</h1>
        <p className="mt-1 text-sm text-ink-500">
          Web / LINE Bot モックから登録された予約と、サロンボード連携の状態を確認できます。
        </p>
      </header>

      <div className="mt-6 card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-pomie-100/50 text-xs uppercase tracking-wider text-pomie-700">
            <tr>
              <th className="px-3 py-2 text-left">予約ID</th>
              <th className="px-3 py-2 text-left">日時</th>
              <th className="px-3 py-2 text-left">店舗</th>
              <th className="px-3 py-2 text-left">美容師</th>
              <th className="px-3 py-2 text-left">メニュー</th>
              <th className="px-3 py-2 text-left">お客様</th>
              <th className="px-3 py-2 text-left">連絡先</th>
              <th className="px-3 py-2 text-left">チャネル</th>
              <th className="px-3 py-2 text-left">ステータス</th>
              <th className="px-3 py-2 text-left">SB状態</th>
              <th className="px-3 py-2 text-left">SB予約ID</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => {
              const stylist = getStylistByIdIncludingInactive(r.stylistId);
              const store = getStoreById(r.storeId);
              return (
                <tr key={r.id} className="border-t border-ink-100/70">
                  <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.desiredDateTime)}</td>
                  <td className="px-3 py-2">{store?.name ?? "-"}</td>
                  <td className="px-3 py-2">{stylist?.name ?? r.stylistId}</td>
                  <td className="px-3 py-2">{r.menu}</td>
                  <td className="px-3 py-2">{r.customerName}</td>
                  <td className="px-3 py-2">{r.customerContact}</td>
                  <td className="px-3 py-2">
                    <span className="chip">{r.channel}</span>
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">
                    <SbBadge status={r.salonboard.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.salonboard.bookingId ?? r.salonboard.errorMessage ?? "-"}
                  </td>
                </tr>
              );
            })}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-sm text-ink-500">
                  まだ予約がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
