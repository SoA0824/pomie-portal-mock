import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { OPERATOR } from "@/lib/data/operator";
import { getAllStores } from "@/lib/data/stores";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: `運営者情報 | ${SITE_NAME}`,
  description: `${SITE_NAME} の運営者情報。`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  if (!OPERATOR.confirmed) notFound();
  const o = OPERATOR;
  const stores = getAllStores();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: o.companyName,
    url: o.officialSiteUrl,
    address: {
      "@type": "PostalAddress",
      postalCode: o.postalCode,
      streetAddress: o.address,
      addressCountry: "JP",
    },
    founder: o.representatives.map((name) => ({ "@type": "Person", name })),
    owns: { "@type": "WebSite", name: o.siteName, url: `${SITE_URL}/` },
  };

  const rows: Array<[string, React.ReactNode]> = [
    ["サイト名", o.siteName],
    ["運営会社", o.companyName],
    ["所在地", `〒${o.postalCode} ${o.address}`],
    ["代表者", o.representatives.join("／")],
    ["設立", o.founded],
    ["事業内容", o.business.join("\n")],
    [
      "店舗",
      <span key="stores" className="flex flex-col gap-1">
        {stores.map((s) => (
          <Link key={s.id} href={`/stores/${s.id}`} className="text-pomie-600 underline">
            {s.name}
          </Link>
        ))}
      </span>,
    ],
    [
      "公式サイト",
      <a key="site" href={o.officialSiteUrl} target="_blank" rel="noreferrer noopener" className="text-pomie-600 underline">
        {o.officialSiteUrl}
      </a>,
    ],
    [
      "お問い合わせ",
      <a key="contact" href={o.contactUrl} target="_blank" rel="noreferrer noopener" className="text-pomie-600 underline">
        お問い合わせページ
      </a>,
    ],
  ];

  return (
    <div className="container-page max-w-3xl py-12">
      <JsonLd data={structuredData} />
      <h1 className="text-2xl font-bold md:text-3xl">運営者情報</h1>
      <p className="mt-3 text-sm text-ink-700">
        {o.siteName} は、シェアサロン「POMiE」を運営する {o.companyName} が運営する美容師紹介サイトです。
      </p>
      <dl className="card mt-8 divide-y divide-ink-100/70 p-5 text-sm md:p-6">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 md:grid-cols-[130px_1fr]">
            <dt className="text-ink-500">{k}</dt>
            <dd className="whitespace-pre-line text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-xs text-ink-500">
        個人情報の取扱いについては
        <Link href="/privacy" className="mx-1 text-pomie-600 underline">
          プライバシーポリシー
        </Link>
        をご覧ください。
      </p>
    </div>
  );
}
