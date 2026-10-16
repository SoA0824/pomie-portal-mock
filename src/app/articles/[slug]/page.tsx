import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article/ArticleView";
import { AreaArticles } from "@/components/article/AreaArticles";
import { getArticleBySlug, getArticlesByArea, resolveArticleSupervisor } from "@/lib/data/articles";
import { getAllPublishedStylists, getStylistById } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";
import { getAreaBySlug, type Area } from "@/lib/areas";
import type { Stylist } from "@/lib/types";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleCover } from "@/lib/articleCover";
import { SITE_NAME, SITE_URL, absoluteUrl, truncate } from "@/lib/site";

export const dynamic = "force-dynamic";

// generateMetadata とページ本体で同じ記事を 2 回 DB から取らないようにする
const loadArticle = cache((slug: string) => getArticleBySlug(slug));
const loadAreaArticles = cache((areaSlug: string) => getArticlesByArea(areaSlug));

/*
 * /articles/{slug} は「記事」と「エリアの記事一覧（/articles/omotesando など）」の両方を受ける。
 * エリアの slug は src/lib/areas.ts で管理し、記事の slug には使えないよう保存時に弾いている。
 */

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const area = getAreaBySlug(params.slug);
  if (area) return areaMetadata(area);

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

async function areaMetadata(area: Area): Promise<Metadata> {
  const articles = await loadAreaArticles(area.slug);
  const title = `${area.name}の美容室・美容師選びの記事一覧 | ${SITE_NAME}`;
  const url = `/articles/${area.slug}`;
  return {
    title,
    description: area.description,
    alternates: { canonical: url },
    // 記事がまだ無いエリアは中身が薄いので検索結果に出さない
    ...(articles.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", url, title, description: area.description },
  };
}

async function AreaPage({ area }: { area: Area }) {
  const [articles, allStylists] = await Promise.all([loadAreaArticles(area.slug), getAllPublishedStylists()]);
  const stores = getAllStores().filter((s) => area.storeIds.includes(s.id));
  const stylists = allStylists.filter((s) => area.storeIds.includes(s.storeId));
  const pageUrl = `${SITE_URL}/articles/${area.slug}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${area.name}の美容室・美容師選びの記事`,
      description: area.description,
      url: pageUrl,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: articles.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/articles/${a.slug}`,
          name: a.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "トップ", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "記事一覧", item: `${SITE_URL}/articles` },
        { "@type": "ListItem", position: 3, name: area.name, item: pageUrl },
      ],
    },
  ];
  return (
    <>
      <JsonLd data={structuredData} />
      <AreaArticles area={area} articles={articles} stylists={stylists} stores={stores} />
    </>
  );
}

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const area = getAreaBySlug(params.slug);
  if (area) return <AreaPage area={area} />;

  const article = await loadArticle(params.slug);
  if (!article) notFound();

  const relatedResults = await Promise.all(
    article.relatedStylistIds.map((id) => getStylistById(id))
  );
  const related = relatedResults.filter((s): s is Stylist => Boolean(s));
  const supervisor = await resolveArticleSupervisor(article);
  const primaryArea = article.areas.map((a) => getAreaBySlug(a)).find(Boolean);

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
      // 監修者（専門家による確認を Google に伝える）
      ...(supervisor
        ? {
            reviewedBy: {
              "@type": "Person",
              name: supervisor.name,
              ...(supervisor.title ? { jobTitle: supervisor.title } : {}),
              ...(supervisor.url ? { url: absoluteUrl(supervisor.url) } : {}),
            },
          }
        : {}),
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
        ...(primaryArea
          ? [{ "@type": "ListItem", position: 3, name: primaryArea.name, item: `${SITE_URL}/articles/${primaryArea.slug}` }]
          : []),
        { "@type": "ListItem", position: primaryArea ? 4 : 3, name: article.title, item: pageUrl },
      ],
    },
  ];

  return (
    <article>
      <JsonLd data={structuredData} />
      <ArticleView article={article} related={related} supervisor={supervisor} />
    </article>
  );
}
