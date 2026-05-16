import Link from "next/link";
import type { Stylist } from "@/lib/types";
import { formatPriceRange } from "@/lib/format";
import { getStoreById } from "@/lib/data/stores";
import { StylistAvatar } from "@/components/common/StylistAvatar";

export function StylistCard({ stylist }: { stylist: Stylist }) {
  const store = getStoreById(stylist.storeId);
  const sns = Object.keys(stylist.snsLinks);
  return (
    <Link href={`/stylists/${stylist.id}`} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-[4/5] overflow-hidden bg-ink-100">
        <StylistAvatar
          src={stylist.avatar}
          name={stylist.name}
          className="h-full w-full transition group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-bold">{stylist.name}</h3>
          <div className="flex items-center gap-1 text-xs text-pomie-600">
            <span aria-hidden>★</span>
            <span className="font-semibold">{stylist.rating.toFixed(1)}</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {store?.name} ・ {stylist.area}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {stylist.menus.slice(0, 3).map((m) => (
            <span key={m.name} className="chip">
              {m.name}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-ink-700">
          <span>{formatPriceRange(stylist.priceRange.min, stylist.priceRange.max)}</span>
          {sns.length > 0 && (
            <span className="text-ink-500">
              SNS: {sns.map((s) => s.toUpperCase()).join(" / ")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
