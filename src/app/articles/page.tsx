import Link from "next/link";
import { ArticleCard } from "@/components/article/ArticleCard";
import { getAllArticles, getArticleCategories } from "@/lib/data/articles";
import type { ArticleCategory } from "@/lib/types";

export const metadata = {
  title: "記事一覧 | POMiE Portal",
};

const CATEGORY_ALL = "all" as const;

export default function ArticlesPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const categories = getArticleCategories();
  const selected = searchParams.category && categories.includes(searchParams.category as ArticleCategory)
    ? (searchParams.category as ArticleCategory)
    : CATEGORY_ALL;
  const all = getAllArticles();
  const articles = selected === CATEGORY_ALL ? all : all.filter((a) => a.category === selected);

  return (
    <div className="container-page py-12">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">記事一覧</h1>
        <p className="mt-2 text-sm text-ink-500">
          髪・美容師選びのヒント。気になる記事から、ポミエ契約美容師を見つけてみてください。
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2">
        <CategoryChip href="/articles" label="すべて" active={selected === CATEGORY_ALL} />
        {categories.map((c) => (
          <CategoryChip
            key={c}
            href={`/articles?category=${encodeURIComponent(c)}`}
            label={c}
            active={selected === c}
          />
        ))}
      </nav>

      <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </section>

      {articles.length === 0 && (
        <p className="mt-8 text-sm text-ink-500">該当する記事がありません。</p>
      )}
    </div>
  );
}

function CategoryChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-pomie-500 text-white"
          : "bg-white text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
      }`}
    >
      {label}
    </Link>
  );
}
