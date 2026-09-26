import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt
 * 管理画面・美容師管理画面・予約手続きなど、検索結果に出す必要のない
 * ページはクロール対象から外す。
 *
 * 注意: "/stylist" と書くと公開ページの "/stylists" まで前方一致で
 * 除外されてしまうため、"/stylist$" と "/stylist/" に分けて指定する。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/stylist$",
          "/stylist/",
          "/api/",
          "/reservations/",
          "/line-bot",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
