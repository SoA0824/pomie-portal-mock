import Link from "next/link";
import type { Store } from "@/lib/types";

/**
 * 店舗カード。背景に店舗写真を敷き、テキストをオーバーレイ表示。
 * 画像が無い場合はブランドカラーのグラデーションにフォールバック。
 */
export function StoreCard({ store }: { store: Store }) {
  return (
    <Link
      href={`/stylists?storeId=${store.id}`}
      className="group relative block aspect-[16/10] overflow-hidden rounded-2xl shadow-sm ring-1 ring-ink-100"
    >
      {/* フォールバック背景（画像が無くても見える） */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-pomie-400 to-pomie-700"
        aria-hidden
      />
      {/* 店舗写真（画像が無ければ 404 で透明 → 上のグラデが見える） */}
      {store.image && (
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url('${store.image}')` }}
          aria-hidden
        />
      )}
      {/* 可読性オーバーレイ */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
        aria-hidden
      />
      {/* テキスト */}
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
          {store.area}
        </span>
        <h3 className="mt-2 text-xl font-bold drop-shadow md:text-2xl">{store.name}</h3>
        {store.catchphrase && (
          <p className="mt-1 line-clamp-2 text-sm text-white/90 drop-shadow">
            {store.catchphrase}
          </p>
        )}
        <p className="mt-2 text-xs font-semibold text-white/90">
          この店舗の美容師を見る →
        </p>
      </div>
    </Link>
  );
}
