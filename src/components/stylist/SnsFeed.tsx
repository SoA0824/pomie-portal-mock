import type { SnsPost } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { proxyIfInstagram } from "@/lib/image-proxy";

const platformLabel: Record<SnsPost["platform"], string> = {
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
};

export function SnsFeed({ posts }: { posts: SnsPost[] }) {
  if (posts.length === 0) {
    return (
      <p className="rounded-xl bg-white p-6 text-sm text-ink-500 ring-1 ring-ink-100">
        SNS 投稿はまだありません。
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {posts.map((p) => (
        <article key={p.id} className="card overflow-hidden">
          <div className="aspect-square overflow-hidden bg-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxyIfInstagram(p.imageUrl)}
              alt={p.caption}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span className="rounded-full bg-pomie-100 px-2 py-0.5 text-pomie-700">
                {platformLabel[p.platform]}
              </span>
              <span>{formatDate(p.postedAt)}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-xs text-ink-700">{p.caption}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
