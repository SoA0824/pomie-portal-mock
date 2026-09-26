import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getStylistOptions } from "@/lib/data/stylistOptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "記事を編集 | 管理 | POMiE Portal" };

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const [article, stylists] = await Promise.all([
    getArticleByIdIncludingDrafts(params.id),
    getStylistOptions(),
  ]);
  if (!article) notFound();

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
        <ArticleForm initial={article} stylists={stylists} />
      </div>
    </div>
  );
}
