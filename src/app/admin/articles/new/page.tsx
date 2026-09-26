import Link from "next/link";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { getStylistOptions } from "@/lib/data/stylistOptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "記事を作成 | 管理 | POMiE Portal" };

export default async function NewArticlePage() {
  const stylists = await getStylistOptions();
  return (
    <div>
      <Link href="/admin/articles" className="text-sm text-pomie-600 hover:underline">
        ← 記事一覧に戻る
      </Link>
      <h1 className="mt-3 text-2xl font-bold">記事を作成</h1>
      <p className="mt-1 text-sm text-ink-500">
        まずは下書きで保存し、プレビューで確認してから公開するのがおすすめです。
      </p>
      <div className="mt-6">
        <ArticleForm stylists={stylists} />
      </div>
    </div>
  );
}
