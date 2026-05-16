import Link from "next/link";
import { notFound } from "next/navigation";
import { SnsFeed } from "@/components/stylist/SnsFeed";
import { StylistAvatar } from "@/components/common/StylistAvatar";
import { getStylistById } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { getSnsPostsByStylistId } from "@/lib/data/snsPosts";
import { formatDateTime, formatPriceRange } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StylistDetailPage({ params }: { params: { id: string } }) {
  const stylist = await getStylistById(params.id);
  if (!stylist) notFound();
  const store = getStoreById(stylist.storeId);
  const posts = await getSnsPostsByStylistId(stylist.id);

  return (
    <div className="container-page py-10">
      <Link href="/stylists" className="text-sm text-pomie-600 hover:underline">
        ← 美容師一覧に戻る
      </Link>

      <section className="mt-6 grid gap-8 md:grid-cols-[280px_1fr]">
        <div>
          <div className="card overflow-hidden">
            <div className="aspect-square overflow-hidden bg-ink-100">
              <StylistAvatar
                src={stylist.avatar}
                name={stylist.name}
                className="h-full w-full"
              />
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="所属店舗" v={store?.name ?? "-"} />
            <Row k="エリア" v={stylist.area} />
            <Row k="評価" v={`★ ${stylist.rating.toFixed(1)} (${stylist.worksCount} 件)`} />
            <Row k="料金目安" v={formatPriceRange(stylist.priceRange.min, stylist.priceRange.max)} />
          </dl>
        </div>

        <div>
          <header>
            <p className="text-sm text-ink-500">{stylist.nameKana}</p>
            <h1 className="mt-1 text-3xl font-bold">{stylist.name}</h1>
            {stylist.strengths.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {stylist.strengths.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-pomie-500 px-3 py-1 text-xs font-semibold text-white shadow-sm"
                  >
                    ✦ {s}
                  </span>
                ))}
              </div>
            )}
            {(stylist.specialtyMenus.length > 0
              ? stylist.specialtyMenus
              : stylist.menus.map((m) => m.name)
            ).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(stylist.specialtyMenus.length > 0
                  ? stylist.specialtyMenus
                  : stylist.menus.map((m) => m.name)
                ).map((m) => (
                  <span key={m} className="chip">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </header>

          <p className="mt-5 leading-relaxed text-ink-700">{stylist.profile}</p>

          {Object.keys(stylist.snsLinks).length > 0 && (
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {Object.entries(stylist.snsLinks).map(([platform, url]) =>
                url ? (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-ink-100 bg-white px-4 py-1.5 text-pomie-600 hover:border-pomie-200"
                  >
                    {platform.toUpperCase()} →
                  </a>
                ) : null
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/reservations/new?stylistId=${stylist.id}`}
              className="btn-primary"
            >
              Web で予約
            </Link>
            <Link href={`/line-bot?stylistId=${stylist.id}`} className="btn-secondary">
              LINE で予約
            </Link>
          </div>
        </div>
      </section>

      {stylist.menus.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold">予約可能なメニュー</h2>
          <p className="mt-1 text-sm text-ink-500">
            それぞれの施術時間を確認して、予約フォームで複数選択できます。
          </p>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {stylist.menus.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-ink-100"
              >
                <span className="font-medium text-ink-900">{m.name}</span>
                <span className="text-sm text-ink-500">{m.duration} 分</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-bold">予約可能な時間</h2>
        <p className="mt-1 text-sm text-ink-500">予約フォームに進むと、これらの時間から選べます。</p>
        {stylist.availableTimeSlots.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">現在予約できる時間がありません。</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {stylist.availableTimeSlots.map((slot) => (
              <li
                key={slot}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-700"
              >
                {formatDateTime(slot)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">SNS 投稿</h2>
        <p className="mt-1 text-sm text-ink-500">作例・スタイリングのアイデアをチェック。</p>
        <div className="mt-5">
          <SnsFeed posts={posts} />
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-100/70 pb-1.5">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right font-medium text-ink-900">{v}</dd>
    </div>
  );
}
