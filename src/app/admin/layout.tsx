import Link from "next/link";

const NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/reservations", label: "予約一覧" },
  { href: "/admin/seats", label: "サロンボード席" },
  { href: "/admin/stylists", label: "美容師" },
  { href: "/admin/articles", label: "記事" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page py-10">
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">管理画面</p>
          <nav className="mt-3 space-y-1">
            {NAV.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="block rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-pomie-100"
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            これは MVP モックです。本番ではアクセス制御を追加してください。
          </p>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
