import Link from "next/link";
import { getAllStylistsIncludingInactive } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { SyncInstagramButton } from "@/components/admin/SyncInstagramButton";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "美容師一覧 | 管理 | POMiE Portal" };

export default async function AdminStylistsPage() {
  const stylists = await getAllStylistsIncludingInactive();
  const sorted = [...stylists].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">美容師一覧（全件）</h1>
          <p className="mt-1 text-sm text-ink-500">
            掲載中（active）と掲載停止（inactive）を含む全件を表示。
            <strong> active のみ</strong>がポータル側で公開対象です。
          </p>
        </div>
        <Link href="/admin/stylists/new" className="btn-primary self-start text-sm">
          + 新規登録
        </Link>
      </header>

      <section className="mt-6 space-y-3">
        {sorted.map((s) => {
          const store = getStoreById(s.storeId);
          return (
            <article key={s.id} className="card p-4 md:p-5">
              <div className="flex flex-wrap items-start gap-4">
                {s.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.avatar}
                    alt={s.name}
                    className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-lg font-bold">{s.name}</h2>
                    {s.nameKana && (
                      <span className="text-xs text-ink-500">{s.nameKana}</span>
                    )}
                    <ContractBadge status={s.contractStatus} />
                    {s.featuredFlag && <FeaturedBadge />}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-ink-500">{s.id}</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs">
                    <Field label="店舗">{store?.name ?? "-"}</Field>
                    <Field label="評価 / 施術数">
                      ★ {s.rating.toFixed(1)} / {s.worksCount} 件
                    </Field>
                    <Field label="得意メニュー">
                      {s.menus.slice(0, 3).join(" / ") || "-"}
                    </Field>
                  </div>
                  {s.instagramHandle && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-semibold text-ink-500">Instagram</span>
                      <a
                        href={`https://www.instagram.com/${s.instagramHandle}/`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-pomie-600 hover:underline"
                      >
                        @{s.instagramHandle}
                      </a>
                      {s.instagramSyncedAt ? (
                        <span className="text-ink-500">
                          最終同期: {formatDateTime(s.instagramSyncedAt)}
                        </span>
                      ) : (
                        <span className="text-ink-500">未同期</span>
                      )}
                      <SyncInstagramButton stylistId={s.id} />
                    </div>
                  )}
                </div>
              </div>

              {/* フッタ: 操作リンク */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100/70 pt-3 text-xs">
                <Link
                  href={`/admin/stylists/${s.id}/edit`}
                  className="rounded-full bg-pomie-500 px-3 py-1 font-semibold text-white transition hover:bg-pomie-600"
                >
                  編集
                </Link>
                <Link
                  href={`/stylists/${s.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-ink-100 bg-white px-3 py-1 font-semibold text-ink-700 transition hover:bg-pomie-100"
                >
                  詳細を見る ↗
                </Link>
                {s.contractStatus === "inactive" && (
                  <span className="text-ink-500">
                    （停止中のため公開ページは表示されません）
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {sorted.length === 0 && (
        <div className="card mt-6 p-10 text-center text-sm text-ink-500">
          まだ美容師が登録されていません。
          <Link href="/admin/stylists/new" className="ml-2 text-pomie-600 hover:underline">
            新規登録する →
          </Link>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <div className="mt-0.5 text-ink-900">{children}</div>
    </div>
  );
}

function ContractBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        status === "active"
          ? "bg-green-100 text-green-800"
          : "bg-ink-100 text-ink-500"
      }`}
    >
      {status === "active" ? "掲載中" : "停止中"}
    </span>
  );
}

function FeaturedBadge() {
  return (
    <span className="rounded-full bg-pomie-100 px-2 py-0.5 text-[10px] font-semibold text-pomie-700">
      ★ 注目
    </span>
  );
}
