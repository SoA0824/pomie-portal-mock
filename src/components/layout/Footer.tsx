import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-pomie-100 bg-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pomie-500 text-xs font-bold text-white">
              P
            </span>
            <span className="font-bold">POMiE Portal</span>
          </div>
          <p className="mt-3 text-xs text-ink-500">
            ポミエ契約美容師に出会えるポータル。<br />
            これは MVP モックです。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:col-span-2 md:grid-cols-4">
          <FooterLinks
            title="サービス"
            items={[
              { label: "美容師を探す", href: "/stylists" },
              { label: "記事を読む", href: "/articles" },
              { label: "LINE で予約", href: "/line-bot" },
            ]}
          />
          <FooterLinks
            title="店舗"
            items={[
              { label: "ポミエ 表参道", href: "/stylists?storeId=s1" },
              { label: "ポミエ 恵比寿", href: "/stylists?storeId=s2" },
            ]}
          />
          <FooterLinks
            title="運営"
            items={[
              { label: "管理画面", href: "/admin" },
              { label: "予約一覧", href: "/admin/reservations" },
            ]}
          />
        </div>
      </div>
      <div className="border-t border-pomie-100 py-4 text-center text-xs text-ink-500">
        © POMiE Portal Mock
      </div>
    </footer>
  );
}

function FooterLinks({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="text-ink-700 hover:text-pomie-600">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
