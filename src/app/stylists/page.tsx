import { StylistCard } from "@/components/stylist/StylistCard";
import { StylistFilters } from "@/components/stylist/StylistFilters";
import { listAllMenus, searchStylists, type StylistSort } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";

export const metadata = {
  title: "美容師を探す | POMiE Portal",
};

export default function StylistsPage({
  searchParams,
}: {
  searchParams: {
    keyword?: string;
    menu?: string;
    storeId?: string;
    hasSns?: string;
    minRating?: string;
    sort?: string;
  };
}) {
  const sort = (searchParams.sort as StylistSort | undefined) ?? "recommended";
  const minRating = searchParams.minRating ? Number(searchParams.minRating) : undefined;

  const stylists = searchStylists(
    {
      keyword: searchParams.keyword,
      menu: searchParams.menu,
      storeId: searchParams.storeId,
      hasSns: searchParams.hasSns === "true",
      minRating: typeof minRating === "number" && !Number.isNaN(minRating) ? minRating : undefined,
    },
    sort
  );
  const menus = listAllMenus();
  const stores = getAllStores();

  return (
    <div className="container-page py-12">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">美容師を探す</h1>
        <p className="mt-2 text-sm text-ink-500">
          ポミエ契約美容師のみを掲載。気になる方の詳細から、Web または LINE で予約できます。
        </p>
      </header>

      <div className="mt-6">
        <StylistFilters menus={menus} stores={stores} current={searchParams} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-ink-700">
          <span className="font-bold">{stylists.length}</span> 名が該当
        </p>
      </div>

      <section className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stylists.map((s) => (
          <StylistCard key={s.id} stylist={s} />
        ))}
      </section>

      {stylists.length === 0 && (
        <p className="mt-10 rounded-xl bg-white p-8 text-center text-sm text-ink-500 ring-1 ring-ink-100">
          条件に合う美容師が見つかりませんでした。条件を変えてお試しください。
        </p>
      )}
    </div>
  );
}
