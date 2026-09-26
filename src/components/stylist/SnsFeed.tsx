import type { SnsPost } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { proxyIfInstagram } from "@/lib/image-proxy";
import { SnsPostCard } from "@/components/stylist/SnsPostCard";

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
        <SnsPostCard
          key={p.id}
          imageSrc={proxyIfInstagram(p.imageUrl)}
          caption={p.caption}
          platformLabel={platformLabel[p.platform]}
          dateLabel={formatDate(p.postedAt)}
        />
      ))}
    </div>
  );
}
