import { getAllStores } from "@/lib/data/stores";
import { getSalonboardClient } from "@/lib/integrations/salonboard";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "サロンボード席状況 | 管理 | POMiE Portal" };

export default async function AdminSeatsPage() {
  const stores = getAllStores();
  const sb = getSalonboardClient();
  const bookings = (await sb.listMockBookings?.()) ?? [];

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">サロンボード（モック）席状況</h1>
        <p className="mt-1 text-sm text-ink-500">
          ポータルからサロンボードに送信した予約の台帳です。本番では Salonboard 側のデータが反映されます。
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {stores.map((s) => {
          const ofShop = bookings.filter((b) => b.shopId === s.salonboardShopId);
          return (
            <div key={s.id} className="card p-5">
              <p className="text-xs text-ink-500">{s.salonboardShopId}</p>
              <p className="text-base font-bold">{s.name}</p>
              <p className="mt-2 text-sm text-ink-700">
                同時受付容量: {s.salonboardCapacityPerSlot} 件 / スロット
              </p>
              <p className="mt-1 text-sm text-ink-700">
                登録済み予約: <span className="font-bold">{ofShop.length}</span> 件
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">予約台帳</h2>
        <div className="mt-3 card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-pomie-100/50 text-xs uppercase tracking-wider text-pomie-700">
              <tr>
                <th className="px-3 py-2 text-left">SB予約ID</th>
                <th className="px-3 py-2 text-left">店舗</th>
                <th className="px-3 py-2 text-left">日時</th>
                <th className="px-3 py-2 text-left">担当美容師</th>
                <th className="px-3 py-2 text-left">お客様</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const store = stores.find((s) => s.salonboardShopId === b.shopId);
                return (
                  <tr key={b.bookingId} className="border-t border-ink-100/70">
                    <td className="px-3 py-2 font-mono text-xs">{b.bookingId}</td>
                    <td className="px-3 py-2">{store?.name ?? b.shopId}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(b.dateTime)}</td>
                    <td className="px-3 py-2">{b.stylistName}</td>
                    <td className="px-3 py-2">{b.customerName}</td>
                  </tr>
                );
              })}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-500">
                    まだ予約がありません。
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
