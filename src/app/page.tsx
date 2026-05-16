import Link from "next/link";
import { ArticleCard } from "@/components/article/ArticleCard";
import { StylistCard } from "@/components/stylist/StylistCard";
import { getFeaturedArticles } from "@/lib/data/articles";
import { getFeaturedStylists } from "@/lib/data/stylists";

export const dynamic = "force-dynamic";

export default async function Home() {
  const articles = getFeaturedArticles(3);
  const stylists = await getFeaturedStylists(4);
  return (
    <>
      <section className="bg-gradient-to-br from-pomie-100 via-pomie-50 to-white">
        <div className="container-page py-16 md:py-24">
          <div className="max-w-2xl">
            <span className="chip">POMiE 集客ポータル（モック）</span>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              あなたの髪を任せられる、<br />
              ポミエの専属美容師に出会う。
            </h1>
            <p className="mt-5 text-base text-ink-700 md:text-lg">
              気になるテーマの記事から、ポミエ契約美容師を見つけて、
              Web または LINE でそのまま予約。<br />
              ポミエの席もあわせて自動で確保します。
            </p>
            <form action="/stylists" method="get" className="mt-8 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                name="keyword"
                placeholder="得意メニュー・お名前で検索 (例: 髪質改善)"
                className="w-full rounded-full border border-pomie-200 bg-white px-5 py-3 text-sm shadow-sm focus:border-pomie-400 focus:outline-none focus:ring-2 focus:ring-pomie-200"
              />
              <button type="submit" className="btn-primary whitespace-nowrap">
                美容師を探す
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-500">
              <span>人気のメニュー:</span>
              {["髪質改善", "メンズカット", "似合わせカラー", "ハイライト", "ヘアセット"].map(
                (m) => (
                  <Link
                    key={m}
                    href={`/stylists?menu=${encodeURIComponent(m)}`}
                    className="rounded-full bg-white px-3 py-1 ring-1 ring-pomie-200 hover:bg-pomie-100"
                  >
                    {m}
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
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
