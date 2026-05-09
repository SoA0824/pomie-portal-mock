import articlesJson from "../../../data/articles.json";
import type { Article, ArticleCategory } from "../types";

const articles = articlesJson as Article[];

export function getAllArticles(): Article[] {
  return [...articles].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
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
