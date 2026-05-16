import { createApifyFetcher } from "./instagram.apify";
import { createMockFetcher } from "./instagram.mock";

export type InstagramPost = {
  externalId: string;
  imageUrl: string;
  caption: string;
  postedAt: string;
  sourceUrl?: string;
};

export interface InstagramFetcher {
  fetchLatestPosts(input: { handle: string; limit?: number }): Promise<InstagramPost[]>;
}

export function getInstagramFetcher(): InstagramFetcher {
  const explicit = process.env.INSTAGRAM_FETCHER;
  const driver = explicit || (process.env.APIFY_API_TOKEN ? "apify" : "mock");
  switch (driver) {
    case "apify":
      return createApifyFetcher();
    case "mock":
    default:
      return createMockFetcher();
  }
}
