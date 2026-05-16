import { notFound } from "next/navigation";
import { StylistForm } from "@/components/admin/StylistForm";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";

export const dynamic = "force-dynamic";
export const metadata = { title: "プロフィール編集 | 美容師管理 | POMiE Portal" };

export default async function StylistProfileEditPage({
  params,
}: {
  params: { id: string };
}) {
  const stylist = await getStylistByIdIncludingInactive(params.id);
  if (!stylist) notFound();
  const stores = getAllStores();

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">プロフィール編集</h1>
        <p className="mt-1 text-sm text-ink-500">
          名前・プロフィール・強み・得意メニュー・予約可能メニュー・料金・Instagram・アバターを編集できます。<br />
          所属店舗・契約状態・注目フラグの変更は POMiE 担当者にご連絡ください。
        </p>
      </header>
      <div className="mt-6">
        <StylistForm
          stores={stores}
          mode="edit"
          initialValues={stylist}
          lockedFields={["storeId", "contractStatus", "featuredFlag"]}
          cancelHref={`/stylist/${stylist.id}`}
          successHref={`/stylist/${stylist.id}`}
        />
      </div>
    </div>
  );
}
