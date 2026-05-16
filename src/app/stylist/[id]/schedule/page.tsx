import { notFound } from "next/navigation";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { StylistScheduleForm } from "@/components/stylist-admin/StylistScheduleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "スケジュール | 美容師管理 | POMiE Portal" };

export default async function StylistSchedulePage({
  params,
}: {
  params: { id: string };
}) {
  const stylist = await getStylistByIdIncludingInactive(params.id);
  if (!stylist) notFound();

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">スケジュール</h1>
        <p className="mt-1 text-sm text-ink-500">
          予約可能な日時を設定します。カレンダー / 日付別 で見やすいビューに切り替え可能。<br />
          時刻ヘッダ・日付ラベルをクリックで列・行を一括 ON/OFF できます。
        </p>
      </header>
      <div className="mt-6">
        <StylistScheduleForm
          stylistId={stylist.id}
          initialSlots={stylist.availableTimeSlots}
        />
      </div>
    </div>
  );
}
