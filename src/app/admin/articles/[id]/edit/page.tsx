import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getStylistOptions } from "@/lib/data/stylistOptions";
import { listRevisionsForArticle } from "@/lib/data/revisions";
import { ArticleRewritePanel } from "@/components/admin/ArticleRewritePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "記事を編集 | 管理 | POMiE Portal" };

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const [article, stylists] = await Promise.all([
    getArticleByIdIncludingDrafts(params.id),
    getStylistOptions(),
  ]);
  if (!article) notFound();
  const { revisions, error: revisionError } = await listRevisionsForArticle(article.id);

  return (
    <div>
      <Link href="/admin/articles" className="text-sm text-pomie-600 hover:underline">
        ← 記事一覧に戻る
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">記事を編集</h1>
        <a
          href={`/admin/articles/${article.id}/preview`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-pomie-600 hover:underline"
        >
          保存済みの内容をプレビュー ↗
        </a>
      </div>
      <div className="mt-6">
        <ArticleRewritePanel article={article} revisions={revisions} stylists={stylists} loadError={revisionError} />
      </div>
      <div className="mt-6">
        {/* リライトの反映で記事が変わったらフォームを作り直す */}
        <ArticleForm key={article.updatedAt} initial={article} stylists={stylists} />
      </div>
    </div>
  );
}
