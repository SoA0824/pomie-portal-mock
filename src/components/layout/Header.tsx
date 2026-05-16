import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-pomie-100/80 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pomie-500 text-sm font-bold text-white">
            P
          </span>
          <span className="text-base font-bold tracking-tight text-ink-900">
            POMiE Portal
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/articles" className="text-ink-700 hover:text-pomie-600">
            記事
          </Link>
          <Link href="/stylists" className="text-ink-700 hover:text-pomie-600">
            美容師を探す
          </Link>
          <Link href="/line-bot" className="text-ink-700 hover:text-pomie-600">
            LINE で予約
          </Link>
          <Link href="/stylist" className="text-ink-500 hover:text-pomie-600">
            美容師ログイン
          </Link>
          <Link href="/admin" className="text-ink-500 hover:text-pomie-600">
            管理
          </Link>
        </nav>
        <Link href="/stylists" className="btn-primary md:hidden text-xs px-4 py-2">
          探す
        </Link>
      </div>
    </header>
  );
}
