import type { MetadataRoute } from "next";

// モック環境はデモ専用のため、検索エンジンのクロールを全面的に拒否する
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
