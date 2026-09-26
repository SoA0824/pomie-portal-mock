import type { Metadata } from "next";
import "../styles/globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, DEFAULT_OG_IMAGE } from "@/lib/site";

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
      </body>
    </html>
  );
}
