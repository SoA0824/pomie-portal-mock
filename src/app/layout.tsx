import type { Metadata } from "next";
import "../styles/globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "POMiE Portal | あなたの専属美容師に出会う",
  description:
    "ポミエ契約美容師に出会えるポータル。記事や診断から、あなたに合う美容師を見つけて予約できます。",
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
