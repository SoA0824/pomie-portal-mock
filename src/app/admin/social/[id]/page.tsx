import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialPostEditor } from "@/components/admin/SocialPostEditor";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getSocialPostById } from "@/lib/data/social";
import { getAllStores } from "@/lib/data/stores";
import { listIntegrationStatus } from "@/lib/integrations/tokens";

export const dynamic = "force-dynamic";
// 書き出し（最大 8 枚の描画）と API 投稿（処理完了待ち）があるので長めに
export const maxDuration = 60;

export default async function AdminSocialDetailPage({ params }: { params: { id: string } }) {
  const post = await getSocialPostById(params.id);
  if (!post) notFound();
  const [article, { statuses }] = await Promise.all([getArticleByIdIncludingDrafts(post.articleId), listIntegrationStatus()]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/social" className="text-sm text-pomie-600 hover:underline">
          ← SNS 投稿の一覧に戻る
        </Link>
        <Link href="/admin/social/settings" className="text-xs text-pomie-600 hover:underline">
          連携設定
        </Link>
      </div>
      <SocialPostEditor post={post} article={article ?? null} stores={getAllStores()} integrations={statuses} />
    </div>
  );
}
