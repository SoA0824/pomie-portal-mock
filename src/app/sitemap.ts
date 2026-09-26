import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getAllArticles } from "@/lib/data/articles";
import { getAllPublishedStylists } from "@/lib/data/stylists";

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

  const articlePages: MetadataRoute.Sitemap = (await getAllArticles()).map((a) => ({
    url: `${SITE_URL}/articles/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

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

  return [...staticPages, ...articlePages, ...stylistPages];
}
