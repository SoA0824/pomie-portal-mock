import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getAllArticles } from "@/lib/data/articles";
import { getAllPublishedStylists } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";
import { AREAS } from "@/lib/areas";

// 美容師は DB から取るので、ビルド時ではなくリクエスト時に生成する
export const dynamic = "force-dynamic";

/**
 * sitemap.xml
 * 公開中のページだけを載せる（非公開の記事・掲載停止中の美容師は含めない）。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/stylists`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/articles`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/match`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const storePages: MetadataRoute.Sitemap = getAllStores().map((s) => ({
    url: `${SITE_URL}/stores/${s.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const publishedArticles = await getAllArticles();
  const articlePages: MetadataRoute.Sitemap = publishedArticles.map((a) => ({
    url: `${SITE_URL}/articles/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // エリアの記事一覧（公開記事が 1 本以上あるエリアだけ。記事が無いページは noindex のため）
  const areaPages: MetadataRoute.Sitemap = AREAS.flatMap((area) => {
    const inArea = publishedArticles.filter((a) => a.areas.includes(area.slug));
    if (inArea.length === 0) return [];
    const latest = inArea.reduce((m, a) => (a.updatedAt > m ? a.updatedAt : m), inArea[0].updatedAt);
    return [{ url: `${SITE_URL}/articles/${area.slug}`, lastModified: new Date(latest), changeFrequency: "weekly" as const, priority: 0.8 }];
  });

  let stylistPages: MetadataRoute.Sitemap = [];
  try {
    const stylists = await getAllPublishedStylists();
    stylistPages = stylists.map((s) => ({
      url: `${SITE_URL}/stylists/${s.id}`,
      lastModified: s.instagramSyncedAt ? new Date(s.instagramSyncedAt) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    // DB に繋がらなくても sitemap 自体は返す（固定ページと記事だけ）
  }

  return [...staticPages, ...storePages, ...areaPages, ...articlePages, ...stylistPages];
}
