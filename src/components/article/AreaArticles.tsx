import Link from "next/link";
import { ArticleCard } from "@/components/article/ArticleCard";
import { StylistCard } from "@/components/stylist/StylistCard";
import type { Area } from "@/lib/areas";
import { AREAS } from "@/lib/areas";
import type { Article, Store, Stylist } from "@/lib/types";

/**
 * エリアの記事一覧（/articles/omotesando など）。
 * そのエリアの記事に加えて、エリアの店舗・美容師への導線をまとめる。
 */
export function AreaArticles({
  area,
  articles,
  stylists,
  stores,
}: {
  area: Area;
  articles: Article[];
  stylists: Stylist[];
  stores: Store[];
}) {
  return (
    <div className="container-page py-12">
      <nav className="text-sm text-ink-500" aria-label="パンくず">
        <Link href="/" className="hover:text-pomie-600">
          トップ
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/articles" className="hover:text-pomie-600">
          記事一覧
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-700">{area.name}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-2xl font-bold md:text-3xl">{area.name}の美容室・美容師選びの記事</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-700">{area.description}</p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="エリア">
        {AREAS.map((a) => (
          <Link
            key={a.slug}
            href={`/articles/${a.slug}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              a.slug === area.slug
                ? "bg-pomie-500 text-white"
                : "bg-white text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
            }`}
          >
            {a.name}
          </Link>
        ))}
        <Link
          href="/articles"
          className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
        >
          すべての記事
        </Link>
      </nav>

      {articles.length > 0 ? (
        <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </section>
      ) : (
        <p className="mt-8 rounded-xl bg-white p-6 text-sm text-ink-500 ring-1 ring-ink-100">
          {area.name}の記事は現在準備中です。下のサロン・美容師のページもご覧ください。
        </p>
      )}

      {(stores.length > 0 || stylists.length > 0) && (
        <section className="mt-14">
          <h2 className="text-xl font-bold">{area.name}のサロンと美容師</h2>
          {stores.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {stores.map((s) => (
                <Link key={s.id} href={`/stores/${s.id}`} className="font-semibold text-pomie-600 hover:underline">
                  {s.name}の店舗情報を見る →
                </Link>
              ))}
            </div>
          )}
          {stylists.length > 0 && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stylists.slice(0, 6).map((s) => (
                <StylistCard key={s.id} stylist={s} />
              ))}
            </div>
          )}
          {stores[0] && (
            <Link href={`/stylists?storeId=${stores[0].id}`} className="btn-secondary mt-6">
              {area.name}の美容師をすべて見る
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
