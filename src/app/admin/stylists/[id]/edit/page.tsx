import Link from "next/link";
import { notFound } from "next/navigation";
import { StylistForm } from "@/components/admin/StylistForm";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";

export const dynamic = "force-dynamic";
export const metadata = { title: "美容師 編集 | 管理 | POMiE Portal" };

export default async function EditStylistPage({ params }: { params: { id: string } }) {
  const stylist = await getStylistByIdIncludingInactive(params.id);
  if (!stylist) notFound();
  const stores = getAllStores();

  return (
    <div>
      <Link href="/admin/stylists" className="text-sm text-pomie-600 hover:underline">
        ← 美容師一覧に戻る
      </Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{stylist.name} を編集</h1>
          <p className="mt-1 text-sm text-ink-500">
            <span className="font-mono">{stylist.id}</span> の情報を変更します。
            Instagram ハンドルを変更すると保存時に投稿を自動で再取得します。
          </p>
        </div>
        <Link
          href={`/stylists/${stylist.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm text-pomie-600 hover:underline"
        >
          公開ページを別タブで見る →
        </Link>
      </header>
      <div className="mt-6">
        <StylistForm stores={stores} mode="edit" initialValues={stylist} />
      </div>
    </div>
  );
}
