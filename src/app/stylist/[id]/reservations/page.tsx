import Link from "next/link";
import { notFound } from "next/navigation";
import { getStylistByIdIncludingInactive } from "@/lib/data/stylists";
import { listReservations } from "@/lib/data/reservations";
import { getStoreById } from "@/lib/data/stores";
import { formatDateTime, formatTimeRange } from "@/lib/format";
import { formatDuration } from "@/lib/menuDurations";

export const dynamic = "force-dynamic";
export const metadata = { title: "予約一覧 | 美容師管理 | POMiE Portal" };

type FilterKey = "all" | "upcoming" | "past" | "confirmed" | "pending";

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "すべて",
  upcoming: "今後",
  past: "過去",
  confirmed: "確定",
  pending: "保留",
};

export default async function StylistReservationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const stylist = await getStylistByIdIncludingInactive(params.id);
  if (!stylist) notFound();
  const store = getStoreById(stylist.storeId);

  const all = await listReservations();
  const mine = all.filter((r) => r.stylistId === stylist.id);

  const filter = (searchParams.filter as FilterKey | undefined) ?? "upcoming";
  const todayKey = new Date().toISOString().slice(0, 10);

  const filtered = mine
    .filter((r) => {
      switch (filter) {
        case "upcoming":
          return r.desiredDateTime.slice(0, 10) >= todayKey;
        case "past":
          return r.desiredDateTime.slice(0, 10) < todayKey;
        case "confirmed":
          return r.status === "confirmed";
        case "pending":
          return r.status === "pending";
        default:
          return true;
      }
    })
    .sort((a, b) => a.desiredDateTime.localeCompare(b.desiredDateTime));

  // 件数（フィルタごとに）
  const counts: Record<FilterKey, number> = {
    all: mine.length,
    upcoming: mine.filter((r) => r.desiredDateTime.slice(0, 10) >= todayKey).length,
    past: mine.filter((r) => r.desiredDateTime.slice(0, 10) < todayKey).length,
    confirmed: mine.filter((r) => r.status === "confirmed").length,
    pending: mine.filter((r) => r.status === "pending").length,
  };

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">予約一覧</h1>
        <p className="mt-1 text-sm text-ink-500">
          あなた宛の予約のみ表示しています。
        </p>
      </header>

      {/* フィルタタブ */}
      <nav className="mt-4 flex flex-wrap gap-1.5">
        {(Object.keys(FILTER_LABEL) as FilterKey[]).map((k) => (
          <Link
            key={k}
            href={`/stylist/${stylist.id}/reservations?filter=${k}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === k
                ? "bg-pomie-500 text-white"
                : "bg-white text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
            }`}
          >
            {FILTER_LABEL[k]} ({counts[k]})
          </Link>
        ))}
      </nav>

      <section className="mt-4 space-y-3">
        {filtered.map((r) => (
          <article key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight md:text-xl">
                  {formatDateTime(r.desiredDateTime)}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {formatTimeRange(r.desiredDateTime, r.durationMinutes)} ・
                  施術 {formatDuration(r.durationMinutes)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-ink-500">{r.id}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ChannelBadge channel={r.channel} />
                <StatusBadge status={r.status} />
                <SbBadge status={r.salonboard.status} />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <FieldRow label="お客様">
                <div className="font-semibold">{r.customerName}</div>
                <div className="text-xs text-ink-500">{r.customerContact}</div>
              </FieldRow>
              <FieldRow label="メニュー">
                <div className="flex flex-wrap gap-1">
                  {r.menus.map((m) => (
                    <span
                      key={m}
                      className="inline-flex rounded-full bg-pomie-100 px-2.5 py-0.5 text-xs text-pomie-700"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-xs text-ink-500">{store?.name ?? "-"}</div>
              </FieldRow>
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="card p-10 text-center text-sm text-ink-500">
            該当する予約はありません。
          </div>
        )}
      </section>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
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

function StatusBadge({ status }: { status: "confirmed" | "pending" | "rejected" }) {
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
