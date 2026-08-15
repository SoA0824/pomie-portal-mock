import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-pomie-100/80 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/articles" className="text-ink-700 hover:text-pomie-600">
            記事
          </Link>
          <Link href="/stylists" className="text-ink-700 hover:text-pomie-600">
            美容師を探す
          </Link>
          <Link href="/match" className="text-pomie-600 hover:text-pomie-700 font-semibold">
            🔍 おすすめ診断
          </Link>
          {/*
            管理画面（/admin）と美容師管理（/stylist）へのリンクは
            一般ユーザーに見せないため掲載しない。URL 直打ちでアクセスする。
          */}
        </nav>
        <Link href="/stylists" className="btn-primary md:hidden text-xs px-4 py-2">
          探す
        </Link>
      </div>
    </header>
  );
}
