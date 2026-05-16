import type { InstagramFetcher } from "./instagram";

/**
 * Apify Instagram Scraper (`apify/instagram-scraper`) を使った実装。
 *
 * 使い方:
 *  1. https://apify.com でサインアップ ($5/月クレジット同梱の Personal プランで十分)
 *  2. Settings → Integrations → API tokens → Create new token
 *  3. .env.local または Vercel の Environment Variables に `APIFY_API_TOKEN=...` を設定
 *  4. （オプション）`INSTAGRAM_FETCHER=apify` を明示指定（既定でも tokens があれば apify）
 *
 * 注意:
 *  - Vercel Hobby プランは Server Action のタイムアウトが 10s。
 *    Apify 同期実行は通常 5〜30s なので、頻繁にタイムアウトする可能性。
 *  - 対策: Vercel Pro プラン (60s) もしくは「非同期 + ポーリング」化（後続フェーズ）。
 */
export function createApifyFetcher(): InstagramFetcher {
  return {
    async fetchLatestPosts({ handle, limit = 8 }) {
      const token = process.env.APIFY_API_TOKEN;
      if (!token) throw new Error("APIFY_API_TOKEN is not configured");

      const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/${handle}/`],
          resultsType: "posts",
          resultsLimit: limit,
          searchType: "user",
          addParentData: false,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Apify error ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as Array<{
        id?: string;
        shortCode?: string;
        displayUrl?: string;
        caption?: string;
        timestamp?: string;
        url?: string;
        type?: string;
      }>;

      return data
        .filter((item) => item.displayUrl)
        .slice(0, limit)
        .map((item) => ({
          externalId: item.shortCode ?? item.id ?? `unknown-${Math.random()}`,
          imageUrl: item.displayUrl ?? "",
          caption: item.caption ?? "",
          postedAt: item.timestamp ?? new Date().toISOString(),
          sourceUrl: item.url,
        }));
    },
  };
}
