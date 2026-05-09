import Link from "next/link";
import { getAllArticles } from "@/lib/data/articles";
import { formatDate } from "@/lib/format";

export const metadata = { title: "記事一覧 | 管理 | POMiE Portal" };

export default function AdminArticlesPage() {
  const articles = getAllArticles();
  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">記事一覧</h1>
        <p className="mt-1 text-sm text-ink-500">
          現状はモックデータ（data/articles.json）から表示しています。本番では Claude API による自動生成 / DB への保存に差し替え予定です。
        </p>
      </header>

      <div className="mt-6 card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-pomie-100/50 text-xs uppercase tracking-wider text-pomie-700">
            <tr>
              <th className="px-3 py-2 text-left">公開日</th>
              <th className="px-3 py-2 text-left">カテゴリ</th>
              <th className="px-3 py-2 text-left">タイトル</th>
              <th className="px-3 py-2 text-left">関連美容師</th>
              <th className="px-3 py-2 text-left">URL</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id} className="border-t border-ink-100/70">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.publishedAt)}</td>
                <td className="px-3 py-2">
                  <span className="chip">{a.category}</span>
                </td>
                <td className="px-3 py-2 font-medium">{a.title}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.relatedStylistIds.join(", ")}</td>
                <td className="px-3 py-2">
                  <Link href={`/articles/${a.slug}`} className="text-pomie-600 hover:underline">
                    /articles/{a.slug}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
