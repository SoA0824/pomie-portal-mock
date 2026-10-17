import Link from "next/link";
import type { Article } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { articleCover } from "@/lib/articleCover";

/**
 * トップの一番上に出す記事（固定した記事 → 新しい順）。
 * SNS のプロフィールのリンクから来た人の受け皿なので、見出しは付けずにすぐ記事が見えるようにする。
 */
export function TopArticles({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;
  return (
    <section className="container-page pt-8 md:pt-12" aria-label="新着記事">
      <ul className="grid gap-3 md:grid-cols-2">
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={`/articles/${a.slug}`} className="card group flex gap-4 p-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-100 md:h-28 md:w-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={articleCover(a)} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              <div className="min-w-0 flex-1 py-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-500">
                  {a.pinnedAt && <span className="rounded-full bg-pomie-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">PICK UP</span>}
                  <span>{formatDate(a.publishedAt)}</span>
                  <span className="chip px-2 py-0 text-[10px]">{a.category}</span>
                </p>
                <h2 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-ink-900 md:text-base">{a.title}</h2>
                <p className="mt-1 hidden line-clamp-2 text-xs text-ink-700 md:block">{a.summary}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <Link href="/articles" className="text-sm font-semibold text-pomie-600 hover:text-pomie-700">
          すべての記事を見る →
        </Link>
      </div>
    </section>
  );
}
