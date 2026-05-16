import Link from "next/link";
import { StylistForm } from "@/components/admin/StylistForm";
import { getAllStores } from "@/lib/data/stores";

export const metadata = { title: "美容師 新規登録 | 管理 | POMiE Portal" };

export default function NewStylistPage() {
  const stores = getAllStores();
  return (
    <div>
      <Link
        href="/admin/stylists"
        className="text-sm text-pomie-600 hover:underline"
      >
        ← 美容師一覧に戻る
      </Link>
      <header className="mt-3">
        <h1 className="text-2xl font-bold">美容師を新規登録</h1>
        <p className="mt-1 text-sm text-ink-500">
          登録すると公開サイトの美容師一覧に即時反映されます。<br />
          Instagram ハンドルを入れると最新 8 投稿の取得を自動で試みます。
          予約可能な時間枠は現時点では設定不要です（今後対応予定）。
        </p>
      </header>
      <div className="mt-6">
        <StylistForm stores={stores} />
      </div>
    </div>
  );
}
