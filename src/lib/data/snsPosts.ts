import postsJson from "../../../data/snsPosts.json";
import type { SnsPost } from "../types";

const posts = postsJson as SnsPost[];

export function getSnsPostsByStylistId(stylistId: string): SnsPost[] {
  return posts
    .filter((p) => p.stylistId === stylistId)
    .sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
}
