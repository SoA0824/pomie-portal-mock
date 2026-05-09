import stylistsJson from "../../../../data/stylists.json";
import { getStoreById } from "@/lib/data/stores";
import type { Stylist } from "@/lib/types";

export const metadata = { title: "美容師一覧 | 管理 | POMiE Portal" };

export default function AdminStylistsPage() {
  const stylists = stylistsJson as Stylist[];

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">美容師一覧（全件）</h1>
        <p className="mt-1 text-sm text-ink-500">
          掲載中（active）と掲載停止（inactive）を含む全件を表示します。
          <strong> active のみ</strong>がポータル側で公開対象です。
        </p>
      </header>

      <div className="mt-6 card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-pomie-100/50 text-xs uppercase tracking-wider text-pomie-700">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">名前</th>
              <th className="px-3 py-2 text-left">店舗</th>
              <th className="px-3 py-2 text-left">得意メニュー</th>
              <th className="px-3 py-2 text-right">評価</th>
              <th className="px-3 py-2 text-right">施術数</th>
              <th className="px-3 py-2 text-left">契約状態</th>
              <th className="px-3 py-2 text-left">注目</th>
              <th className="px-3 py-2 text-right">予約枠</th>
            </tr>
          </thead>
          <tbody>
            {stylists.map((s) => {
              const store = getStoreById(s.storeId);
              return (
                <tr key={s.id} className="border-t border-ink-100/70">
                  <td className="px-3 py-2 font-mono text-xs">{s.id}</td>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{store?.name ?? "-"}</td>
                  <td className="px-3 py-2">{s.menus.slice(0, 3).join(" / ")}</td>
                  <td className="px-3 py-2 text-right">{s.rating.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{s.worksCount}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        s.contractStatus === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-ink-100 text-ink-500"
                      }`}
                    >
                      {s.contractStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.featuredFlag ? "★" : ""}</td>
                  <td className="px-3 py-2 text-right">{s.availableTimeSlots.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
