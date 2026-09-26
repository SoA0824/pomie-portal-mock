import Link from "next/link";
import { getAllArticlesIncludingDrafts } from "@/lib/data/articles";
import { formatDate } from "@/lib/format";

export const metadata = { title: "記事一覧 | 管理 | POMiE Portal" };

export default function AdminArticlesPage() {
  const articles = getAllArticlesIncludingDrafts();
  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">記事一覧</h1>
        <p className="mt-1 text-sm text-ink-500">
          記事は現在ファイル管理です。今後、自動生成と管理画面からの編集に対応予定です。
        </p>
      </header>

      <div className="mt-6 card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-pomie-100/50 text-xs uppercase tracking-wider text-pomie-700">
            <tr>
              <th className="px-3 py-2 text-left">状態</th>
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
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      a.published ? "bg-green-100 text-green-800" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {a.published ? "公開" : "非公開"}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.publishedAt)}</td>
                <td className="px-3 py-2">
                  <span className="chip">{a.category}</span>
                </td>
                <td className="px-3 py-2 font-medium">{a.title}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.relatedStylistIds.join(", ")}</td>
                <td className="px-3 py-2">
                  {a.published ? (
                    <Link href={`/articles/${a.slug}`} className="text-pomie-600 hover:underline">
                      /articles/{a.slug}
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-500">/articles/{a.slug}（非公開）</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
