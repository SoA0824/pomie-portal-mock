import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StylistCard } from "@/components/stylist/StylistCard";
import { StoreGallery } from "@/components/store/StoreGallery";
import { JsonLd } from "@/components/seo/JsonLd";
import { getStoreById } from "@/lib/data/stores";
import { getAllPublishedStylists } from "@/lib/data/stylists";
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE, absoluteUrl, truncate } from "@/lib/site";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";

function paragraphsOf(store: Store): string[] {
  return (store.description ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const store = getStoreById(params.id);
  if (!store) return { title: `店舗が見つかりません | ${SITE_NAME}` };

  const title = `${store.name}｜${store.area}のシェアサロン | ${SITE_NAME}`;
  // 紹介文の 1 段落目を優先（キャッチコピーと内容が重なりやすいので連結しない）
  const description = truncate(
    paragraphsOf(store)[0] ||
      store.catchphrase ||
      `${store.area}にあるポミエのシェアサロン「${store.name}」。店内の様子と在籍する美容師をご紹介します。`,
    120
  );
  const image = store.image ?? DEFAULT_OG_IMAGE;
  const url = `/stores/${store.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, images: [{ url: image, alt: store.name }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const store = getStoreById(params.id);
  if (!store) notFound();

  const stylists = (await getAllPublishedStylists()).filter((s) => s.storeId === store.id);
  const gallery = store.gallery?.length ? store.gallery : store.image ? [store.image] : [];
  const paragraphs = paragraphsOf(store);
  const features = store.features ?? [];

  // 住所は正確性を確認済みのときだけ載せる
  const showAddress = Boolean(store.addressVerified && store.address);
  const mapUrl =
    store.mapUrl ??
    (showAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`
      : null);
  const infoRows = [
    showAddress ? ["住所", store.address] : null,
    store.access ? ["アクセス", store.access] : null,
    store.hours ? ["営業時間", store.hours] : null,
    store.holidays ? ["定休日", store.holidays] : null,
    store.phone ? ["電話番号", store.phone] : null,
  ].filter((r): r is [string, string] => r !== null);

  const pageUrl = `${SITE_URL}/stores/${store.id}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "HairSalon",
      "@id": `${pageUrl}#salon`,
      name: store.name,
      url: pageUrl,
      ...(gallery.length > 0 ? { image: gallery.map(absoluteUrl) } : {}),
      ...(paragraphs.length > 0 ? { description: truncate(paragraphs.join(" "), 200) } : {}),
      areaServed: store.area,
      parentOrganization: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
      ...(showAddress
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: store.address,
              addressCountry: "JP",
            },
          }
        : {}),
      ...(store.phone ? { telephone: store.phone } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "トップ", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: store.name, item: pageUrl },
      ],
    },
  ];

  return (
    <div>
      <JsonLd data={structuredData} />

      {/* メインビジュアル */}
      <section className="relative h-[52vw] max-h-[540px] min-h-[280px] overflow-hidden bg-gradient-to-br from-pomie-600 to-pomie-900">
        {store.image && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${store.image}')` }}
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10"
          aria-hidden
        />
        <div className="container-page relative flex h-full flex-col justify-end pb-8 text-white md:pb-12">
          <Link href="/" className="mb-auto mt-6 text-sm text-white/80 hover:text-white">
            ← トップに戻る
          </Link>
          <span className="inline-flex w-fit items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {store.area}
          </span>
          <h1 className="mt-3 text-3xl font-bold drop-shadow md:text-5xl">{store.name}</h1>
          {store.catchphrase && (
            <p className="mt-3 max-w-2xl text-sm text-white/90 drop-shadow md:text-lg">
              {store.catchphrase}
            </p>
          )}
        </div>
      </section>

      <div className="container-page py-12">
        {/* 紹介文・特徴 */}
        {(paragraphs.length > 0 || features.length > 0) && (
          <section className="grid gap-8 md:grid-cols-[1fr_320px]">
            <div className="space-y-4 text-ink-700 leading-relaxed">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {features.length > 0 && (
              <ul className="card space-y-2 p-5 text-sm">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 text-pomie-500" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 店内の様子 */}
        {gallery.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold">店内の様子</h2>
            <p className="mt-1 text-sm text-ink-500">写真をクリックすると拡大して見られます。</p>
            <div className="mt-5">
              <StoreGallery images={gallery} storeName={store.name} />
            </div>
          </section>
        )}

        {/* 店舗情報 */}
        {(infoRows.length > 0 || mapUrl) && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold">店舗情報</h2>
            <div className="card mt-5 p-5 md:p-6">
              <dl className="divide-y divide-ink-100/70 text-sm">
                {infoRows.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-3 md:grid-cols-[120px_1fr]">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="whitespace-pre-line text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 inline-flex text-sm font-semibold text-pomie-600 hover:text-pomie-700"
                >
                  地図を見る ↗
                </a>
              )}
            </div>
          </section>
        )}

        {/* この店舗の美容師 */}
        <section className="mt-12">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">この店舗の美容師</h2>
              <p className="mt-1 text-sm text-ink-500">
                {store.name}に在籍する、ポミエ契約美容師です。
              </p>
            </div>
            {stylists.length > 0 && (
              <Link
                href={`/stylists?storeId=${store.id}`}
                className="self-start text-sm font-semibold text-pomie-600 hover:text-pomie-700 md:self-auto"
              >
                条件を絞って探す →
              </Link>
            )}
          </div>
          {stylists.length === 0 ? (
            <p className="card mt-5 p-6 text-sm text-ink-500">
              現在、この店舗で掲載中の美容師はいません。
            </p>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stylists.map((s) => (
                <StylistCard key={s.id} stylist={s} />
              ))}
            </div>
          )}
        </section>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link href="/stylists" className="btn-primary">
            すべての美容師を見る
          </Link>
          <Link href="/match" className="btn-secondary">
            おすすめ診断を試す
          </Link>
        </div>
      </div>
    </div>
  );
}
