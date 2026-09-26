import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { StylistCard } from "@/components/stylist/StylistCard";
import type { Article, Stylist } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { articleCover } from "@/lib/articleCover";

/**
 * 記事の本体表示。公開ページと管理画面のプレビューで共通。
 */
export function ArticleView({ article, related }: { article: Article; related: Stylist[] }) {
  return (
    <>
      <div className="aspect-[2/1] w-full overflow-hidden bg-ink-100 md:aspect-[3/1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={articleCover(article)} alt={article.title} className="h-full w-full object-cover" />
      </div>
      <div className="container-page py-10">
        <Link href="/articles" className="text-sm text-pomie-600 hover:underline">
          ← 記事一覧に戻る
        </Link>
        <header className="mt-4">
          <span className="chip">{article.category}</span>
          <h1 className="mt-3 text-2xl font-bold leading-snug md:text-4xl">{article.title}</h1>
          <p className="mt-2 text-xs text-ink-500">{formatDate(article.publishedAt)}</p>
        </header>

        <div className="markdown mt-8 max-w-3xl">
          <ReactMarkdown>{article.body}</ReactMarkdown>
        </div>

        {related.length > 0 && (
          <section className="mt-14 max-w-5xl">
            <h2 className="text-xl font-bold">この記事で紹介した美容師</h2>
            <p className="mt-1 text-sm text-ink-500">
              気になる美容師は、詳細ページから予約に進めます。
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <StylistCard key={s.id} stylist={s} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link href="/stylists" className="btn-primary">
            すべての美容師を見る
          </Link>
          <Link href="/match" className="btn-secondary">
            おすすめ診断を試す
          </Link>
        </div>
      </div>
    </>
  );
}
