import Link from "next/link";
import { notFound } from "next/navigation";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { listReservations } from "@/lib/data/reservations";
import { getStoreById } from "@/lib/data/stores";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ダッシュボード | 美容師管理 | POMiE Portal" };

export default async function StylistDashboardPage({
  params,
}: {
  params: { id: string };
}) {
  const stylist = await getStylistByIdIncludingInactive(params.id);
  if (!stylist) notFound();
  const store = getStoreById(stylist.storeId);
  const allReservations = await listReservations();
  const mine = allReservations.filter((r) => r.stylistId === stylist.id);

  // 日付ベースの集計
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const in7Key = in7Days.toISOString().slice(0, 10);

  const todays = mine.filter((r) => r.desiredDateTime.startsWith(todayKey));
  const upcoming7Days = mine
    .filter((r) => {
      const d = r.desiredDateTime.slice(0, 10);
      return d >= todayKey && d <= in7Key;
    })
    .sort((a, b) => a.desiredDateTime.localeCompare(b.desiredDateTime));
  const upcomingAll = mine
    .filter((r) => r.desiredDateTime.slice(0, 10) >= todayKey)
    .sort((a, b) => a.desiredDateTime.localeCompare(b.desiredDateTime));

  const futureSlots = stylist.availableTimeSlots.filter(
    (s) => s.slice(0, 10) >= todayKey
  );

  const igRegistered = Boolean(stylist.instagramHandle);
  const strengthsCount = stylist.strengths.length;
  const specialtyCount = stylist.specialtyMenus.length;
  const menusCount = stylist.menus.length;

  return (
    <div>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="mt-1 text-sm text-ink-500">
            {stylist.name} さん（{store?.name}）の状況をひと目で確認できます。
          </p>
        </div>
      </header>

      {/* 数値カード */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="今日の予約"
          value={todays.length}
          unit="件"
          tone={todays.length > 0 ? "info" : "default"}
        />
        <Stat
          label="今後 7 日の予約"
          value={upcoming7Days.length}
          unit="件"
        />
        <Stat
          label="今後の空き枠"
          value={futureSlots.length}
          unit="枠"
          tone={futureSlots.length < 3 ? "alert" : "default"}
        />
        <Stat
          label="掲載状態"
          value={stylist.contractStatus === "active" ? "公開中" : "停止中"}
          tone={stylist.contractStatus === "active" ? "ok" : "default"}
        />
      </section>

      {/* 直近の予約 */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">直近の予約</h2>
          <Link
            href={`/stylist/${stylist.id}/reservations`}
            className="text-xs text-pomie-600 hover:underline"
          >
            すべて見る →
          </Link>
        </div>

        <div className="mt-3 space-y-2">
          {upcomingAll.slice(0, 3).map((r) => (
            <article
              key={r.id}
              className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
            >
              <div>
                <p className="font-semibold">{formatDateTime(r.desiredDateTime)}</p>
                <p className="text-xs text-ink-500">
                  {r.customerName} ・ {r.menus.join(" + ")} ・ {r.durationMinutes}分
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  r.status === "confirmed"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {r.status === "confirmed" ? "確定" : "保留"}
              </span>
            </article>
          ))}
          {upcomingAll.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-500">
              今後の予約はまだありません。
            </div>
          )}
        </div>
      </section>

      {/* セットアップ状況 */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">プロフィール充実度</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SetupRow
            label="強み"
            value={`${strengthsCount} 件`}
            done={strengthsCount > 0}
            href={`/stylist/${stylist.id}/profile`}
            cta="強みを追加"
          />
          <SetupRow
            label="得意メニュー"
            value={`${specialtyCount} 件`}
            done={specialtyCount > 0}
            href={`/stylist/${stylist.id}/profile`}
            cta="得意メニューを追加"
          />
          <SetupRow
            label="予約可能メニュー"
            value={`${menusCount} 件`}
            done={menusCount > 0}
            href={`/stylist/${stylist.id}/profile`}
            cta="メニューを設定"
          />
          <SetupRow
            label="Instagram"
            value={
              igRegistered
                ? stylist.instagramSyncedAt
                  ? `@${stylist.instagramHandle} ・ 最終同期 ${formatDateTime(stylist.instagramSyncedAt)}`
                  : `@${stylist.instagramHandle} ・ 未同期`
                : "未登録"
            }
            done={igRegistered}
            href={`/stylist/${stylist.id}/profile`}
            cta="Instagram を登録"
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: number | string;
  unit?: string;
  tone?: "default" | "ok" | "info" | "alert";
}) {
  const toneStyle =
    tone === "ok"
      ? "ring-green-300"
      : tone === "info"
        ? "ring-pomie-300"
        : tone === "alert"
          ? "ring-amber-300"
          : "ring-ink-100";
  return (
    <div className={`card p-4 ring-2 ${toneStyle}`}>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-500">{unit}</span>}
      </p>
    </div>
  );
}

function SetupRow({
  label,
  value,
  done,
  href,
  cta,
}: {
  label: string;
  value: string;
  done: boolean;
  href: string;
  cta: string;
}) {
  return (
    <div className="card flex items-center justify-between p-3 text-sm">
      <div>
        <p className="font-semibold">
          {done ? "✅" : "⚠️"} {label}
        </p>
        <p className="text-xs text-ink-500">{value}</p>
      </div>
      {!done && (
        <Link href={href} className="text-xs font-semibold text-pomie-600 hover:underline">
          {cta} →
        </Link>
      )}
    </div>
  );
}
