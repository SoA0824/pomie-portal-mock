import type { Article } from "./types";
import { DEFAULT_OG_IMAGE } from "./site";

/** 表示用のカバー画像。未設定ならトップのメインビジュアルを使う */
export function articleCover(article: Pick<Article, "coverImage">): string {
  return article.coverImage || DEFAULT_OG_IMAGE;
}
