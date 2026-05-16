import Link from "next/link";
import { listReservations } from "@/lib/data/reservations";
import { getAllStylistsIncludingInactive } from "@/lib/data/stylists";
import { getStoreById } from "@/lib/data/stores";
import { formatDateTime, formatTimeRange } from "@/lib/format";
import { formatDuration } from "@/lib/menuDurations";

export const dynamic = "force-dynamic";
export const metadata = { title: "予約一覧 | 管理 | POMiE Portal" };

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: { channel?: "web" | "line" };
}) {
  const [allReservations, stylists] = await Promise.all([
    listReservations(),
    getAllStylistsIncludingInactive(),
  ]);
  const stylistMap = new Map(stylists.map((s) => [s.id, s]));
  const all = allReservations.slice().reverse();
  const cf = searchParams.channel;
  const reservations = cf ? all.filter((r) => r.channel === cf) : all;
  const webCount = all.filter((r) => r.channel === "web").length;
  const lineCount = all.filter((r) => r.channel === "line").length;

  return (
    <div>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">予約一覧</h1>
          <p className="mt-1 text-sm text-ink-500">
            Web / LINE Bot から登録された予約とサロンボード連携の状態。
          </p>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          <FilterChip
            href="/admin/reservations"
            label={`すべて (${all.length})`}
            active={!cf}
          />
          <FilterChip
            href="/admin/reservations?channel=web"
            label={`Web (${webCount})`}
            active={cf === "web"}
          />
          <FilterChip
            href="/admin/reservations?channel=line"
            label={`LINE (${lineCount})`}
            active={cf === "line"}
          />
        </nav>
      </header>

      <section className="mt-6 space-y-3">
        {reservations.map((r) => {
          const stylist = stylistMap.get(r.stylistId);
          const store = getStoreById(r.storeId);
          return (
            <article key={r.id} className="card p-4 md:p-5">
              {/* ヘッダ行: 日時 + 各種ステータス */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-tight md:text-2xl">
                    {formatDateTime(r.desiredDateTime)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {formatTimeRange(r.desiredDateTime, r.durationMinutes)} ・
                    施術 {formatDuration(r.durationMinutes)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-ink-500">{r.id}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ChannelBadge channel={r.channel} />
                  <StatusBadge status={r.status} />
                  <SbBadge status={r.salonboard.status} />
                </div>
              </div>

              {/* 本文: 美容師・店舗・メニュー / お客様 */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="美容師・店舗・メニュー">
                  <div className="font-semibold">{stylist?.name ?? r.stylistId}</div>
                  <div className="text-xs text-ink-500">{store?.name ?? "-"}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.menus.map((m) => (
                      <span
                        key={m}
                        className="inline-flex rounded-full bg-pomie-100 px-2.5 py-0.5 text-xs text-pomie-700"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </Field>
                <Field label="お客様">
                  <div className="font-semibold">{r.customerName}</div>
                  <div className="text-xs text-ink-500">{r.customerContact}</div>
                </Field>
              </div>

              {/* フッタ: サロンボード詳細 */}
              {(r.salonboard.bookingId || r.salonboard.errorMessage) && (
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100/70 pt-3 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-ink-500">
                    サロンボード
                  </span>
                  {r.salonboard.bookingId && (
                    <span className="font-mono text-ink-700">
                      {r.salonboard.bookingId}
                    </span>
                  )}
                  {r.salonboard.errorMessage && (
                    <span className="text-red-700">{r.salonboard.errorMessage}</span>
                  )}
                  {r.salonboard.syncedAt && (
                    <span className="text-ink-500">
                      同期: {formatDateTime(r.salonboard.syncedAt)}
                    </span>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {reservations.length === 0 && (
          <div className="card p-10 text-center text-sm text-ink-500">
            該当する予約がありません。
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <div className="mt-1.5 text-sm text-ink-900">{children}</div>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-pomie-500 text-white"
          : "bg-white text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
      }`}
    >
      {label}
    </Link>
  );
}

function ChannelBadge({ channel }: { channel: "web" | "line" }) {
  if (channel === "web") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
        Web
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
      LINE
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: "confirmed" | "pending" | "rejected";
}) {
  const map = {
    confirmed: { label: "確定", style: "bg-green-100 text-green-800" },
    pending: { label: "保留", style: "bg-amber-100 text-amber-800" },
    rejected: { label: "拒否", style: "bg-red-100 text-red-800" },
  } as const;
  const { label, style } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}

function SbBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; style: string }> = {
    reserved: { label: "SB 同期済", style: "bg-green-100 text-green-800" },
    pending: { label: "SB 保留", style: "bg-amber-100 text-amber-800" },
    unavailable: { label: "SB 満席", style: "bg-red-100 text-red-800" },
    failed: { label: "SB 失敗", style: "bg-red-100 text-red-800" },
  };
  const config = map[status] ?? { label: status, style: "bg-ink-100 text-ink-700" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.style}`}
    >
      {config.label}
    </span>
  );
}
