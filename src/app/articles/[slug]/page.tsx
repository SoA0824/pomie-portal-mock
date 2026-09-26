import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { StylistCard } from "@/components/stylist/StylistCard";
import { getAllArticles, getArticleBySlug } from "@/lib/data/articles";
import { getStylistById } from "@/lib/data/stylists";
import type { Stylist } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_NAME, SITE_URL, absoluteUrl, truncate } from "@/lib/site";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const article = getArticleBySlug(params.slug);
  if (!article) return { title: `記事が見つかりません | ${SITE_NAME}` };
  const title = `${article.title} | ${SITE_NAME}`;
  const description = truncate(article.summary || article.body, 120);
  const url = `/articles/${article.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      publishedTime: article.publishedAt,
      images: [{ url: article.coverImage, alt: article.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [article.coverImage] },
  };
}

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const article = getArticleBySlug(params.slug);
  if (!article) notFound();

  const relatedResults = await Promise.all(
    article.relatedStylistIds.map((id) => getStylistById(id))
  );
  const related = relatedResults.filter((s): s is Stylist => Boolean(s));

  const pageUrl = `${SITE_URL}/articles/${article.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: truncate(article.summary || article.body, 200),
      image: absoluteUrl(article.coverImage),
      datePublished: article.publishedAt,
      mainEntityOfPage: pageUrl,
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        logo: { "@type": "ImageObject", url: absoluteUrl("/logo/pomie-logo.svg") },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "トップ", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "記事一覧", item: `${SITE_URL}/articles` },
        { "@type": "ListItem", position: 3, name: article.title, item: pageUrl },
      ],
    },
  ];

  return (
    <article>
      <JsonLd data={structuredData} />
      <div className="aspect-[2/1] w-full overflow-hidden bg-ink-100 md:aspect-[3/1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover" />
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
    </article>
  );
}
