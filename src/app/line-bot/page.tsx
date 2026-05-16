import { ChatWindow } from "@/components/linebot/ChatWindow";
import { getAllPublishedStylists } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LINE Bot 予約 (モック) | POMiE Portal",
};

export default async function LineBotPage({
  searchParams,
}: {
  searchParams: { stylistId?: string };
}) {
  const stylists = await getAllPublishedStylists();
  const stores = getAllStores();

  return (
    <div className="container-page py-12">
      <header className="text-center">
        <span className="chip">LINE Bot 予約モック</span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">
          チャット形式でかんたん予約
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-500">
          これは LINE Messaging API を想定したモック画面です。
          実際の LINE 連携はせず、ポータル内で同じ予約フローを再現しています。
        </p>
      </header>

      <div className="mt-8">
        <ChatWindow
          stylists={stylists}
          stores={stores}
          initialStylistId={searchParams.stylistId}
        />
      </div>

      <p className="mx-auto mt-6 max-w-md text-center text-xs text-ink-500">
        ※ 予約と同時にサロンボード（モック）の席も自動で確保されます。<br />
        Web 予約と同じ Server Action を経由するため、データ・処理は同一です。
      </p>
    </div>
  );
}
