import articlesJson from "../../../data/articles.json";
import type { Article, ArticleCategory } from "../types";

const allArticles = articlesJson as Article[];
/** 公開中の記事だけ。サイト側の表示・sitemap はすべてこれを使う */
const articles = allArticles.filter((a) => a.published);

const byNewest = (a: Article, b: Article) => (a.publishedAt < b.publishedAt ? 1 : -1);

export function getAllArticles(): Article[] {
  return [...articles].sort(byNewest);
}

/** 管理画面用: 非公開も含めた全記事 */
export function getAllArticlesIncludingDrafts(): Article[] {
  return [...allArticles].sort(byNewest);
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getArticleCategories(): ArticleCategory[] {
  const set = new Set<ArticleCategory>();
  for (const a of articles) set.add(a.category);
  return Array.from(set);
}

export function getArticlesByCategory(category: ArticleCategory): Article[] {
  return getAllArticles().filter((a) => a.category === category);
}

export function getFeaturedArticles(limit = 3): Article[] {
  return getAllArticles()
    .filter((a) => a.relatedStylistIds.length > 0)
    .slice(0, limit);
}
