import Link from "next/link";
import { getAllStylistsIncludingInactive } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { StylistAvatar } from "@/components/common/StylistAvatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "美容師ログイン (デモ) | POMiE Portal" };

export default async function StylistLoginPage() {
  const stylists = await getAllStylistsIncludingInactive();
  const sorted = [...stylists].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="container-page py-12">
      <header className="text-center">
        <span className="chip">DEMO MODE</span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">美容師アカウントを選択</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-500">
          本番では各美容師がメールアドレスでログインしますが、デモ環境では認証なしで
          自分のアカウントを下から選んでください。
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((s) => {
          const store = getStoreById(s.storeId);
          return (
            <Link
              key={s.id}
              href={`/stylist/${s.id}`}
              className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <StylistAvatar
                src={s.avatar}
                name={s.name}
                rounded
                className="h-14 w-14 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-ink-500">{store?.name ?? "-"}</p>
                <p className="mt-0.5 font-mono text-[10px] text-ink-500">{s.id}</p>
              </div>
              {s.contractStatus === "inactive" && (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-500">
                  停止中
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
