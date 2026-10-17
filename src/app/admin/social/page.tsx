import Link from "next/link";
import { getAllArticlesIncludingDrafts } from "@/lib/data/articles";
import { listSocialPosts } from "@/lib/data/social";
import { PLATFORM_LABEL, SOCIAL_STATUS_LABEL } from "@/lib/social/labels";
import { formatDateTime } from "@/lib/format";
import type { SocialPostStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: string; label: string; statuses: SocialPostStatus[] | null }> = [
  { key: "open", label: "進行中", statuses: ["requested", "draft", "ready", "failed"] },
  { key: "requested", label: "作成待ち", statuses: ["requested"] },
  { key: "ready", label: "投稿できます", statuses: ["ready"] },
  { key: "posted", label: "投稿済み", statuses: ["posted"] },
  { key: "all", label: "すべて", statuses: null },
];

export default async function AdminSocialPage({ searchParams }: { searchParams?: { filter?: string; article?: string } }) {
  const [{ posts, error }, articles] = await Promise.all([listSocialPosts(), getAllArticlesIncludingDrafts()]);
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const filterKey = searchParams?.filter ?? "open";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const shown = posts.filter((p) => (!filter.statuses || filter.statuses.includes(p.status)) && (!searchParams?.article || p.articleId === searchParams.article));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">SNS 投稿</h1>
          <p className="mt-1 text-sm text-ink-500">
            記事をもとにした Instagram / X 向けの投稿文とスライド画像。記事一覧の「SNS 投稿を作る」で依頼し、Claude Code の{" "}
            <code className="rounded bg-ink-100 px-1 text-xs">/make-social-post</code> で作ります。投稿は手動です（書き出した画像と本文をコピーして投稿）。
          </p>
        </div>
        <Link href="/admin/articles" className="btn-secondary px-4 py-2 text-xs">
          記事一覧へ
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          投稿を読み込めませんでした（{error}）。初回は Supabase の SQL Editor で{" "}
          <code className="rounded bg-white px-1">supabase/migration-013-social-posts.sql</code> を実行してください。
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {FILTERS.map((f) => {
          const count = posts.filter((p) => !f.statuses || f.statuses.includes(p.status)).length;
          return (
            <Link
              key={f.key}
              href={`/admin/social?filter=${f.key}`}
              className={`rounded-full px-3 py-1 ${f.key === filter.key ? "bg-pomie-500 text-white" : "bg-ink-100 text-ink-700 hover:bg-pomie-100"}`}
            >
              {f.label} {count}
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">該当する投稿はありません。</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-pomie-50 text-xs text-ink-500">
              <tr>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">媒体</th>
                <th className="px-3 py-2">記事 / 表紙の見出し</th>
                <th className="px-3 py-2">更新</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const a = articleById.get(p.articleId);
                const s = SOCIAL_STATUS_LABEL[p.status];
                const cover = p.slides[0]?.headline;
                return (
                  <tr key={p.id} className="border-t border-ink-100/70 align-top">
                    <td className="px-3 py-2">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>
                      {p.imageRequest && p.status === "requested" && <p className="mt-1 text-[11px] text-ink-500">画像の作り直し</p>}
                      {p.status === "posted" && (
                        <p className="mt-1 text-[11px] text-ink-500">
                          {p.platforms.map((pl) => `${PLATFORM_LABEL[pl]}${p.posted[pl] ? " ✓" : ""}`).join(" / ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-700">{p.platforms.map((pl) => PLATFORM_LABEL[pl]).join(" + ")}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/social/${p.id}`} className="font-medium text-ink-900 hover:text-pomie-600">
                        {cover || a?.title || "(記事なし)"}
                      </Link>
                      <p className="text-[11px] text-ink-500">
                        記事: {a ? a.title : p.articleId}
                        {p.brief && <span> ・ 指示: {p.brief}</span>}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-500">{formatDateTime(p.updatedAt)}</td>
                    <td className="px-3 py-2 text-xs">
                      <Link href={`/admin/social/${p.id}`} className="text-pomie-600 hover:underline">
                        開く
                      </Link>
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
