import Link from "next/link";
import { notFound } from "next/navigation";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { StylistAvatar } from "@/components/common/StylistAvatar";

export const dynamic = "force-dynamic";

export default async function StylistAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const stylist = await getStylistByIdIncludingInactive(params.id);
  if (!stylist) notFound();
  const store = getStoreById(stylist.storeId);

  const nav = [
    { href: `/stylist/${stylist.id}`, label: "ダッシュボード", icon: "📊" },
    { href: `/stylist/${stylist.id}/profile`, label: "プロフィール", icon: "👤" },
    { href: `/stylist/${stylist.id}/schedule`, label: "スケジュール", icon: "📅" },
    {
      href: `/stylist/${stylist.id}/reservations`,
      label: "予約一覧",
      icon: "📝",
    },
  ];

  return (
    <div>
      {/* DEMO 警告バナー */}
      <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-800">
        <strong>DEMO MODE</strong>: 認証なしで全美容師にアクセスできます。本番では
        Supabase Auth で本人確認を行います。
      </div>

      <div className="container-page py-8">
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <aside>
            {/* プロフィール */}
            <div className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink-100">
              <StylistAvatar
                src={stylist.avatar}
                name={stylist.name}
                rounded
                className="h-12 w-12 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{stylist.name}</p>
                <p className="truncate text-xs text-ink-500">{store?.name ?? "-"}</p>
                <span
                  className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    stylist.contractStatus === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {stylist.contractStatus === "active" ? "掲載中" : "停止中"}
                </span>
              </div>
            </div>

            {/* ナビ */}
            <nav className="mt-3 space-y-1">
              {nav.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 transition hover:bg-pomie-100"
                >
                  <span>{it.icon}</span>
                  {it.label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-xs">
              <Link
                href={`/stylists/${stylist.id}`}
                target="_blank"
                rel="noreferrer noopener"
                className="block text-pomie-600 hover:underline"
              >
                公開ページを見る ↗
              </Link>
              <Link href="/stylist" className="block text-ink-500 hover:underline">
                ← 別の美容師として入る
              </Link>
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
