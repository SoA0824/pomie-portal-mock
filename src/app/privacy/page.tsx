import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OPERATOR } from "@/lib/data/operator";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: `プライバシーポリシー | ${SITE_NAME}`,
  description: `${SITE_NAME} における個人情報と利用者情報（外部送信）の取扱いについて。`,
  alternates: { canonical: "/privacy" },
};

/** 外部送信（電気通信事業法の外部送信規律）として公表する送信先 */
const EXTERNAL_TRANSMISSIONS = [
  {
    service: "Google アナリティクス",
    provider: "Google LLC",
    data: "閲覧したページの URL、参照元、端末・ブラウザの種類、IP アドレス、Cookie による識別子、サイト内での操作（予約ボタンのクリックなど）",
    purpose: "本サイトの利用状況の分析と改善",
    policyUrl: "https://policies.google.com/privacy",
    optOut: { label: "Google アナリティクス オプトアウト アドオン", url: "https://tools.google.com/dlpage/gaoptout" },
  },
];

export default function PrivacyPage() {
  if (!OPERATOR.confirmed) notFound();
  const o = OPERATOR;

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-2xl font-bold md:text-3xl">プライバシーポリシー</h1>

      <div className="mt-8 space-y-10 text-sm leading-relaxed text-ink-700">
        <section className="space-y-3">
          <p>
            本サイト「{o.siteName}」（{SITE_URL.replace(/^https?:\/\//, "")}）は、{o.companyName}（以下「当社」といいます）が運営しています。
          </p>
          <p>
            本サイトにおける個人情報の取扱いは、
            <a href={o.corporatePrivacyPolicyUrl} target="_blank" rel="noreferrer noopener" className="text-pomie-600 underline">
              当社のプライバシーポリシー
            </a>
            に従います。このページでは、本サイトに固有の取扱いを補足して説明します。
          </p>
        </section>

        <Section title="1. 本サイトで取得する情報">
          <ul className="list-disc space-y-1 pl-5">
            <li>予約フォームをご利用いただいた場合：お名前、ご連絡先、ご希望の日時・メニュー</li>
            <li>本サイトの閲覧時：閲覧したページ、参照元、端末・ブラウザの種類、IP アドレス、Cookie などの識別子、サイト内での操作</li>
          </ul>
        </Section>

        <Section title="2. 利用目的">
          <ul className="list-disc space-y-1 pl-5">
            <li>ご予約の受付と、担当する美容師へのご予約内容の連絡</li>
            <li>本サイトの利用状況の分析と改善</li>
            <li>お問い合わせへの対応</li>
          </ul>
        </Section>

        <Section title="3. 美容師ごとの予約受付先について">
          <p>
            美容師によっては、美容師自身が用意した予約フォームや SNS（Instagram のダイレクトメッセージなど）でご予約を受け付けています。
            リンク先で入力された情報は、リンク先の運営者・美容師の方針に従って取り扱われ、当社が取得することはありません。
          </p>
        </Section>

        <Section title="4. 利用者情報の外部送信について">
          <p>
            本サイトでは、利用状況を分析するために、次の外部サービスへ利用者の情報を送信しています（電気通信事業法に基づく公表事項）。
          </p>
          <div className="mt-3 space-y-4">
            {EXTERNAL_TRANSMISSIONS.map((t) => (
              <dl key={t.service} className="card divide-y divide-ink-100/70 p-4">
                <Row k="送信先">
                  {t.service}（{t.provider}）
                </Row>
                <Row k="送信される情報">{t.data}</Row>
                <Row k="利用目的">{t.purpose}</Row>
                <Row k="送信先の方針">
                  <a href={t.policyUrl} target="_blank" rel="noreferrer noopener" className="break-all text-pomie-600 underline">
                    {t.policyUrl}
                  </a>
                </Row>
                <Row k="送信を止める方法">
                  <a href={t.optOut.url} target="_blank" rel="noreferrer noopener" className="text-pomie-600 underline">
                    {t.optOut.label}
                  </a>
                  を導入すると、Google アナリティクスへの送信を止められます。
                </Row>
              </dl>
            ))}
          </div>
        </Section>

        <Section title="5. 業務の委託">
          <p>
            本サイトの運営にあたり、サーバー・データベースなどの提供事業者に、個人情報の取扱いの全部または一部を委託することがあります。
            その場合は、委託先を適切に監督します。
          </p>
        </Section>

        <Section title="6. お問い合わせ窓口">
          <p>
            本ポリシーや個人情報の取扱いに関するお問い合わせは、
            <a href={o.contactUrl} target="_blank" rel="noreferrer noopener" className="text-pomie-600 underline">
              {o.companyName} のお問い合わせページ
            </a>
            からお願いいたします。
          </p>
        </Section>

        <p className="text-xs text-ink-500">制定日：{o.privacyPolicyEstablished}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 md:grid-cols-[130px_1fr]">
      <dt className="text-xs font-semibold text-ink-500">{k}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}
