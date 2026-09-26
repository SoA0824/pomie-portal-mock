import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article/ArticleView";
import { getArticleBySlug } from "@/lib/data/articles";
import { getStylistById } from "@/lib/data/stylists";
import type { Stylist } from "@/lib/types";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleCover } from "@/lib/articleCover";
import { SITE_NAME, SITE_URL, absoluteUrl, truncate } from "@/lib/site";

export const dynamic = "force-dynamic";

// generateMetadata とページ本体で同じ記事を 2 回 DB から取らないようにする
const loadArticle = cache((slug: string) => getArticleBySlug(slug));

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const article = await loadArticle(params.slug);
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
      modifiedTime: article.updatedAt,
      images: [{ url: articleCover(article), alt: article.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [articleCover(article)] },
  };
}

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const article = await loadArticle(params.slug);
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
      image: absoluteUrl(articleCover(article)),
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
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
      <ArticleView article={article} related={related} />
    </article>
  );
}
