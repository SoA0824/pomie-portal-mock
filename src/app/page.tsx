import Link from "next/link";
import { ArticleCard } from "@/components/article/ArticleCard";
import { StylistCard } from "@/components/stylist/StylistCard";
import { StoreCard } from "@/components/store/StoreCard";
import { getFeaturedArticles } from "@/lib/data/articles";
import { getFeaturedStylists } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";

export const dynamic = "force-dynamic";

export default async function Home() {
  const articles = getFeaturedArticles(3);
  const stylists = await getFeaturedStylists(4);
  const stores = getAllStores();
  return (
    <>
      {/* メインビジュアル */}
      <section className="relative overflow-hidden bg-gradient-to-br from-pomie-600 to-pomie-900">
        {/* 背景写真（public/images/hero/hero.jpg を置くと表示。無ければブランドグラデ） */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero/hero.jpg')" }}
          aria-hidden
        />
        {/* 可読性オーバーレイ */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/30"
          aria-hidden
        />
        <div className="container-page relative py-20 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              POMiE 集客ポータル
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-lg md:text-5xl">
              あなたの髪を任せられる、<br />
              ポミエの専属美容師に出会う。
            </h1>
            <p className="mt-5 text-base text-white/90 drop-shadow md:text-lg">
              気になるテーマの記事から、ポミエ契約美容師を見つけて、
              Web または LINE でそのまま予約。<br />
              ポミエの席もあわせて自動で確保します。
            </p>
            <form action="/stylists" method="get" className="mt-8 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                name="keyword"
                placeholder="得意メニュー・お名前で検索 (例: 髪質改善)"
                className="w-full rounded-full border border-white/30 bg-white px-5 py-3 text-sm shadow-sm focus:border-pomie-400 focus:outline-none focus:ring-2 focus:ring-pomie-300"
              />
              <button type="submit" className="btn-primary whitespace-nowrap">
                美容師を探す
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/80">
              <span>人気のメニュー:</span>
              {["髪質改善", "メンズカット", "似合わせカラー", "ハイライト", "ヘアセット"].map(
                (m) => (
                  <Link
                    key={m}
                    href={`/stylists?menu=${encodeURIComponent(m)}`}
                    className="rounded-full bg-white/90 px-3 py-1 text-ink-700 ring-1 ring-white/40 backdrop-blur hover:bg-white"
                  >
                    {m}
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* マッチング診断 CTA */}
      <section className="container-page pt-14">
        <Link
          href="/match"
          className="group block overflow-hidden rounded-3xl bg-gradient-to-br from-pomie-500 to-pomie-700 p-8 text-white shadow-md transition hover:shadow-lg md:p-12"
        >
          <div className="flex flex-wrap items-center gap-6 md:gap-10">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                🔍 新機能 ・ 30 秒で診断
              </span>
              <h2 className="mt-3 text-2xl font-bold leading-snug md:text-3xl">
                あなたにぴったりの美容師、<br />
                4 つの質問で見つけませんか？
              </h2>
              <p className="mt-3 text-sm text-pomie-50 md:text-base">
                髪のお悩み・希望スタイル・店舗エリア・予算を選ぶだけ。<br className="hidden md:block" />
                ポミエ契約美容師から相性のいい 3 人を提案します。
              </p>
            </div>
            <div className="rounded-full bg-white px-6 py-3 text-sm font-bold text-pomie-600 shadow-md transition group-hover:scale-105">
              診断スタート →
            </div>
          </div>
        </Link>
      </section>

      <section className="container-page py-14">
        <SectionHeader
          title="髪・美容師選びのヒント"
          subtitle="まずは気になる記事を読んで、自分に合う美容師像を見つけてみてください。"
          link={{ href: "/articles", label: "すべての記事を見る" }}
        />
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </section>

      <section className="container-page py-14">
        <SectionHeader
          title="注目のポミエ美容師"
          subtitle="今月とくに予約が集まっている、ポミエ契約美容師を厳選。"
          link={{ href: "/stylists", label: "美容師一覧を見る" }}
        />
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stylists.map((s) => (
            <StylistCard key={s.id} stylist={s} />
          ))}
        </div>
      </section>

      {/* サロン紹介 */}
      <section className="container-page py-14">
        <SectionHeader
          title="サロン紹介"
          subtitle="表参道・恵比寿の 2 店舗。通いやすい店舗からも美容師を探せます。"
        />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {stores.map((s) => (
            <StoreCard key={s.id} store={s} />
          ))}
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="card flex flex-col items-start gap-6 bg-pomie-100/60 p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="text-xl font-bold md:text-2xl">LINE で気軽に予約できます</h2>
            <p className="mt-2 text-sm text-ink-700">
              チャット形式で美容師選び・日時・メニューを案内。
              <br className="md:hidden" />
              席の空きも同時に確保します（モック動作）。
            </p>
          </div>
          <Link href="/line-bot" className="btn-primary">
            LINE 予約モックを試す
          </Link>
        </div>
      </section>
    </>
  );
}

function SectionHeader({
  title,
  subtitle,
  link,
}: {
  title: string;
  subtitle: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
      </div>
      {link && (
        <Link
          href={link.href}
          className="self-start text-sm font-semibold text-pomie-600 hover:text-pomie-700 md:self-auto"
        >
          {link.label} →
        </Link>
      )}
    </div>
  );
}
