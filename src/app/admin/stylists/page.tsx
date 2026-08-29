import Link from "next/link";
import { getAllStylistsIncludingInactive } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";
import { AdminStylistList, type SortKey } from "@/components/admin/AdminStylistList";

export const dynamic = "force-dynamic";
export const metadata = { title: "美容師一覧 | 管理 | POMiE Portal" };

const VALID_SORTS: SortKey[] = ["id", "name", "rating", "featured", "newest"];

export default async function AdminStylistsPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const stylists = await getAllStylistsIncludingInactive();
  const stores = getAllStores();
  const storesById = Object.fromEntries(stores.map((s) => [s.id, s]));
  const sortParam = searchParams.sort as SortKey | undefined;
  const sort: SortKey = sortParam && VALID_SORTS.includes(sortParam) ? sortParam : "id";

  return (
    <div>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">美容師一覧（全件）</h1>
          <p className="mt-1 text-sm text-ink-500">
            掲載中（active）と掲載停止（inactive）を含む全件を表示。
            <strong> active のみ</strong>がポータル側で公開対象です。
          </p>
        </div>
        <Link href="/admin/stylists/new" className="btn-primary self-start text-sm">
          + 新規登録
        </Link>
      </header>

      {stylists.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-sm text-ink-500">
          まだ美容師が登録されていません。
          <Link
            href="/admin/stylists/new"
            className="ml-2 text-pomie-600 hover:underline"
          >
            新規登録する →
          </Link>
        </div>
      ) : (
        <AdminStylistList stylists={stylists} storesById={storesById} sort={sort} />
      )}
    </div>
  );
}
