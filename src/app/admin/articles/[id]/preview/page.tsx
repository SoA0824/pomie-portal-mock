import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article/ArticleView";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getStylistById } from "@/lib/data/stylists";
import type { Stylist } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "記事プレビュー | 管理 | POMiE Portal",
  robots: { index: false, follow: false },
};

/**
 * 下書きを含む記事を、公開ページと同じ見た目で確認する（管理画面の Basic 認証内）。
 */
export default async function ArticlePreviewPage({ params }: { params: { id: string } }) {
  const article = await getArticleByIdIncludingDrafts(params.id);
  if (!article) notFound();
  const related = (await Promise.all(article.relatedStylistIds.map((id) => getStylistById(id)))).filter(
    (s): s is Stylist => Boolean(s)
  );

  return (
    <div className="overflow-hidden rounded-2xl bg-pomie-50 ring-1 ring-ink-100">
      <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-800">
        プレビュー表示です（{article.status === "published" ? "公開中" : "下書き・サイトには表示されていません"}）
      </div>
      <ArticleView article={article} related={related} />
    </div>
  );
}
