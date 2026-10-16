import Link from "next/link";
import { ApproveArticlePanel } from "@/components/admin/ApproveArticlePanel";
import { getAllArticlesIncludingDrafts } from "@/lib/data/articles";
import { getStylistOptions } from "@/lib/data/stylistOptions";
import { formatDateTime } from "@/lib/format";
import type { Article } from "@/lib/types";
import { AREAS } from "@/lib/areas";

const AREA_NAME: Record<string, string> = Object.fromEntries(AREAS.map((a) => [a.slug, a.name]));

export const dynamic = "force-dynamic";
export const metadata = { title: "記事一覧 | 管理 | POMiE Portal" };

export default async function AdminArticlesPage() {
  let articles: Article[] = [];
  let loadError: string | null = null;
  try {
    articles = await getAllArticlesIncludingDrafts();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  const stylists = await getStylistOptions();
  const stylistName = new Map(stylists.map((s) => [s.id, s.name]));
  const publishedCount = articles.filter((a) => a.status === "published").length;
  const draftCount = articles.length - publishedCount;

  return (
    <div>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">記事一覧</h1>
          <p className="mt-1 text-sm text-ink-500">
            全 {articles.length} 件（公開 {publishedCount} 件 / 下書き {draftCount} 件）。
            下書きはサイトに表示されません。自動執筆の記事はプレビューで確認してから「承認して公開」します。
          </p>
        </div>
        <Link href="/admin/articles/new" className="btn-primary self-start text-sm">
          + 新規作成
        </Link>
      </header>

      {loadError && (
        <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">記事を読み込めませんでした</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-xs">
            記事用のテーブルが未作成の可能性があります。Supabase の SQL Editor で
            <code className="mx-1">supabase/migration-008-articles.sql</code>と
            <code className="mx-1">migration-009-keyword-pipeline.sql</code>を実行してください。
          </p>
        </div>
      )}

      {!loadError && articles.length === 0 && (
        <div className="card mt-6 p-10 text-center text-sm text-ink-500">
          まだ記事がありません。
          <Link href="/admin/articles/new" className="ml-2 text-pomie-600 hover:underline">
            最初の記事を書く →
          </Link>
        </div>
      )}

      {articles.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-pomie-100/50 text-xs tracking-wider text-pomie-700">
              <tr>
                <th className="px-3 py-2 text-left">状態</th>
                <th className="px-3 py-2 text-left">タイトル</th>
                <th className="px-3 py-2 text-left">キーワード</th>
                <th className="px-3 py-2 text-left">監修者</th>
                <th className="px-3 py-2 text-left">更新</th>
                <th className="px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const lintErrors = a.generationLog?.lintErrors?.length ?? 0;
                const lintWarnings = a.generationLog?.lintWarnings?.length ?? 0;
                const supervisor = a.supervisorStylistId
                  ? stylistName.get(a.supervisorStylistId) ?? a.supervisorStylistId
                  : a.supervisorName;
                return (
                  <tr key={a.id} className="border-t border-ink-100/70 align-top">
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
                            a.status === "published" ? "bg-green-100 text-green-800" : "bg-ink-100 text-ink-500"
                          }`}
                        >
                          {a.status === "published" ? "公開" : "下書き"}
                        </span>
                        {a.source === "ai" && (
                          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            自動執筆
                          </span>
                        )}
                      </div>
                      {a.source === "ai" && a.status !== "published" && (lintErrors > 0 || lintWarnings > 0) && (
                        <p className={`mt-1 whitespace-nowrap text-[11px] ${lintErrors > 0 ? "text-red-700" : "text-ink-500"}`}>
                          検品: {lintErrors > 0 ? `要修正 ${lintErrors} 件` : ""}
                          {lintErrors > 0 && lintWarnings > 0 ? " / " : ""}
                          {lintWarnings > 0 ? `注意 ${lintWarnings} 件` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/articles/${a.id}/edit`} className="font-medium text-ink-900 hover:text-pomie-600">
                        {a.title}
                      </Link>
                      <p className="font-mono text-[11px] text-ink-500">
                        /articles/{a.slug} ・ <span className="font-sans">{a.category}</span>
                        {a.areas.length > 0 && <span className="font-sans"> ・ {a.areas.map((s) => AREA_NAME[s] ?? s).join("・")}</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-700">{a.targetKeyword ?? "-"}</td>
                    <td className="px-3 py-2 text-xs text-ink-700">{supervisor ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-500">{formatDateTime(a.updatedAt)}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap">
                        <Link href={`/admin/articles/${a.id}/edit`} className="text-pomie-600 hover:underline">
                          編集
                        </Link>
                        <span className="text-ink-300">|</span>
                        <a
                          href={`/admin/articles/${a.id}/preview`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pomie-600 hover:underline"
                        >
                          プレビュー
                        </a>
                        {a.status === "published" && (
                          <>
                            <span className="text-ink-300">|</span>
                            <a
                              href={`/articles/${a.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-pomie-600 hover:underline"
                            >
                              公開ページ ↗
                            </a>
                          </>
                        )}
                      </div>
                      {a.status !== "published" && (
                        <div className="mt-2">
                          <ApproveArticlePanel
                            articleId={a.id}
                            articleTitle={a.title}
                            stylists={stylists}
                            initialSupervisorStylistId={a.supervisorStylistId}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
