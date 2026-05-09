import type { Store } from "@/lib/types";

export type CurrentFilters = {
  keyword?: string;
  menu?: string;
  storeId?: string;
  hasSns?: string;
  minRating?: string;
  sort?: string;
};

export function StylistFilters({
  menus,
  stores,
  current,
}: {
  menus: string[];
  stores: Store[];
  current: CurrentFilters;
}) {
  return (
    <form action="/stylists" method="get" className="card grid gap-4 p-5 md:grid-cols-6">
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-ink-700">キーワード</label>
        <input
          name="keyword"
          defaultValue={current.keyword ?? ""}
          placeholder="名前・得意分野"
          className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-pomie-400 focus:outline-none focus:ring-1 focus:ring-pomie-200"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-700">メニュー</label>
        <select
          name="menu"
          defaultValue={current.menu ?? ""}
          className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-pomie-400 focus:outline-none focus:ring-1 focus:ring-pomie-200"
        >
          <option value="">すべて</option>
          {menus.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-700">店舗</label>
        <select
          name="storeId"
          defaultValue={current.storeId ?? ""}
          className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-pomie-400 focus:outline-none focus:ring-1 focus:ring-pomie-200"
        >
          <option value="">すべて</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-700">最低評価</label>
        <select
          name="minRating"
          defaultValue={current.minRating ?? ""}
          className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-pomie-400 focus:outline-none focus:ring-1 focus:ring-pomie-200"
        >
          <option value="">指定なし</option>
          <option value="4.5">★ 4.5 以上</option>
          <option value="4.7">★ 4.7 以上</option>
          <option value="4.8">★ 4.8 以上</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-700">並び順</label>
        <select
          name="sort"
          defaultValue={current.sort ?? "recommended"}
          className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-pomie-400 focus:outline-none focus:ring-1 focus:ring-pomie-200"
        >
          <option value="recommended">おすすめ順</option>
          <option value="rating">評価順</option>
          <option value="works">施術数順</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4 md:col-span-5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            name="hasSns"
            value="true"
            defaultChecked={current.hasSns === "true"}
            className="h-4 w-4 rounded border-ink-300 text-pomie-500 focus:ring-pomie-200"
          />
          SNS連携あり
        </label>
      </div>
      <div className="md:col-span-1 md:flex md:justify-end">
        <button type="submit" className="btn-primary w-full md:w-auto">
          絞り込む
        </button>
      </div>
    </form>
  );
}
