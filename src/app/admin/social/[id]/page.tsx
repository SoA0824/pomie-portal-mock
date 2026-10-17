import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialPostEditor } from "@/components/admin/SocialPostEditor";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getSocialPostById } from "@/lib/data/social";
import { getAllStores } from "@/lib/data/stores";

export const dynamic = "force-dynamic";

export default async function AdminSocialDetailPage({ params }: { params: { id: string } }) {
  const post = await getSocialPostById(params.id);
  if (!post) notFound();
  const article = await getArticleByIdIncludingDrafts(post.articleId);
  return (
    <div>
      <Link href="/admin/social" className="text-sm text-pomie-600 hover:underline">
        ← SNS 投稿の一覧に戻る
      </Link>
      <SocialPostEditor post={post} article={article ?? null} stores={getAllStores()} />
    </div>
  );
}
