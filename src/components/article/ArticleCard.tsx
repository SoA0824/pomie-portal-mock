import Link from "next/link";
import type { Article } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-[2/1] overflow-hidden bg-ink-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.coverImage}
          alt={article.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="p-5">
        <span className="chip">{article.category}</span>
        <h3 className="mt-3 text-base font-bold leading-snug text-ink-900">{article.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-ink-700">{article.summary}</p>
        <p className="mt-3 text-xs text-ink-500">{formatDate(article.publishedAt)}</p>
      </div>
    </Link>
  );
}
