import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { StylistCard } from "@/components/stylist/StylistCard";
import { StylistAvatar } from "@/components/common/StylistAvatar";
import type { Article, ArticleSupervisor, Stylist } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { articleCover } from "@/lib/articleCover";
import { getAreaBySlug } from "@/lib/areas";

/**
 * 記事の本体表示。公開ページと管理画面のプレビューで共通。
 */
export function ArticleView({
  article,
  related,
  supervisor,
}: {
  article: Article;
  related: Stylist[];
  supervisor?: ArticleSupervisor | null;
}) {
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{article.category}</span>
            {article.areas.map((slug) => {
              const area = getAreaBySlug(slug);
              return area ? (
                <Link
                  key={slug}
                  href={`/articles/${area.slug}`}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-pomie-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
                >
                  {area.name}の記事
                </Link>
              ) : null;
            })}
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-snug md:text-4xl">{article.title}</h1>
          <p className="mt-2 text-xs text-ink-500">
            {formatDate(article.publishedAt)}
            {article.updatedAt > article.publishedAt && `（更新: ${formatDate(article.updatedAt)}）`}
          </p>
        </header>

        {supervisor && <SupervisorCard supervisor={supervisor} />}

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

/** 「この記事の監修者」カード */
function SupervisorCard({ supervisor }: { supervisor: ArticleSupervisor }) {
  return (
    <aside className="mt-5 flex max-w-3xl items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink-100">
      <StylistAvatar src={supervisor.avatar} name={supervisor.name} className="h-12 w-12 shrink-0" rounded />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">この記事の監修者</p>
        <p className="truncate font-semibold text-ink-900">{supervisor.name}</p>
        {supervisor.title && <p className="truncate text-xs text-ink-700">{supervisor.title}</p>}
      </div>
      {supervisor.url && (
        <Link href={supervisor.url} className="shrink-0 text-xs font-semibold text-pomie-600 hover:underline">
          プロフィールを見る →
        </Link>
      )}
    </aside>
  );
}
