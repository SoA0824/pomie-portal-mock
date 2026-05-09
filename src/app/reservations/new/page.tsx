import Link from "next/link";
import { notFound } from "next/navigation";
import { ReservationForm } from "@/components/reservation/ReservationForm";
import { getStylistById } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";

export const metadata = {
  title: "予約 | POMiE Portal",
};

export default function NewReservationPage({
  searchParams,
}: {
  searchParams: { stylistId?: string };
}) {
  if (!searchParams.stylistId) notFound();
  const stylist = getStylistById(searchParams.stylistId);
  if (!stylist) notFound();
  const store = getStoreById(stylist.storeId);
  if (!store) notFound();

  return (
    <div className="container-page py-12">
      <Link href={`/stylists/${stylist.id}`} className="text-sm text-pomie-600 hover:underline">
        ← 美容師詳細に戻る
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-bold md:text-3xl">予約フォーム</h1>
        <p className="mt-2 text-sm text-ink-500">
          {stylist.name}（{store.name}）の予約を行います。
          予約と同時にサロンボードの席も自動で確保します。
        </p>
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
        <ReservationForm stylist={stylist} store={store} />
        <aside>
          <div className="card overflow-hidden">
            <div className="aspect-square overflow-hidden bg-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stylist.avatar} alt={stylist.name} className="h-full w-full object-cover" />
            </div>
            <div className="p-4">
              <p className="text-sm font-bold">{stylist.name}</p>
              <p className="mt-1 text-xs text-ink-500">{store.name}</p>
              <p className="mt-2 text-xs text-ink-500">★ {stylist.rating.toFixed(1)} ({stylist.worksCount}件)</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
