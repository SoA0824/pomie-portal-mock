import type { Metadata } from "next";
import "../styles/globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  GA_MEASUREMENT_ID,
} from "@/lib/site";

/**
 * GA は Vercel の本番環境だけで読み込む（ローカル・プレビューのアクセスは送らない）。
 * ローカルで動作確認したいときは GA_FORCE_ENABLE=1 を付けて起動する。
 */
const gaEnabled =
  Boolean(GA_MEASUREMENT_ID) &&
  (process.env.VERCEL_ENV === "production" || process.env.GA_FORCE_ENABLE === "1");

export const metadata: Metadata = {
  // 相対パスの OGP 画像・canonical を絶対 URL に解決する基準
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} | あなたの専属美容師に出会う`,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ja_JP",
    title: `${SITE_NAME} | あなたの専属美容師に出会う`,
    description: SITE_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, width: 2732, height: 1242, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
  },
  // Google Search Console の所有権確認（HTML タグ方式）。
  // Vercel の環境変数 GOOGLE_SITE_VERIFICATION に確認コードを入れて再デプロイすると
  // <meta name="google-site-verification" content="..."> が出力される。
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        {gaEnabled && <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />}
      </body>
    </html>
  );
}
