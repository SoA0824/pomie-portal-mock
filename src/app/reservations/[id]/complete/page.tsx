import Link from "next/link";
import { notFound } from "next/navigation";
import { getReservationById } from "@/lib/data/reservations";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "予約完了 | POMiE Portal",
};

export default async function ReservationCompletePage({
  params,
}: {
  params: { id: string };
}) {
  const reservation = await getReservationById(params.id);
  if (!reservation) notFound();
  const stylist = getStylistByIdIncludingInactive(reservation.stylistId);
  const store = getStoreById(reservation.storeId);

  const isConfirmed = reservation.status === "confirmed";

  return (
    <div className="container-page py-12">
      <div
        className={`card mx-auto max-w-2xl p-8 ${
          isConfirmed ? "" : "ring-2 ring-amber-300"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-pomie-600">
          {isConfirmed ? "予約が確定しました" : "予約は保留中です"}
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          {isConfirmed ? "ありがとうございました" : "サロンボード連携に失敗しました"}
        </h1>
        <p className="mt-2 text-sm text-ink-700">
          予約番号: <span className="font-mono font-semibold">{reservation.id}</span>
        </p>

        <dl className="mt-6 space-y-2 text-sm">
          <Row k="美容師" v={stylist?.name ?? "-"} />
          <Row k="店舗" v={store?.name ?? "-"} />
          <Row k="日時" v={formatDateTime(reservation.desiredDateTime)} />
          <Row k="メニュー" v={reservation.menu} />
          <Row k="お名前" v={reservation.customerName} />
          <Row k="ご連絡先" v={reservation.customerContact} />
          <Row k="チャネル" v={reservation.channel === "web" ? "Web" : "LINE Bot (モック)"} />
        </dl>

        <div
          className={`mt-6 rounded-xl p-4 text-sm ${
            reservation.salonboard.status === "reserved"
              ? "bg-green-50 text-green-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-semibold">サロンボード同期状況</p>
          <p className="mt-1">
            ステータス: <span className="font-mono">{reservation.salonboard.status}</span>
          </p>
          {reservation.salonboard.bookingId && (
            <p className="mt-1">
              サロンボード予約 ID:{" "}
              <span className="font-mono">{reservation.salonboard.bookingId}</span>
            </p>
          )}
          {reservation.salonboard.errorMessage && (
            <p className="mt-1">エラー: {reservation.salonboard.errorMessage}</p>
          )}
          {reservation.salonboard.syncedAt && (
            <p className="mt-1 text-xs">同期日時: {formatDateTime(reservation.salonboard.syncedAt)}</p>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">
            トップへ戻る
          </Link>
          <Link href="/stylists" className="btn-secondary">
            他の美容師も見る
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-100/70 pb-1.5">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right font-medium text-ink-900">{v}</dd>
    </div>
  );
}
