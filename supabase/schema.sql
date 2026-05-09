-- POMiE Portal Mock — Supabase スキーマ
-- 適用方法: Supabase Studio の SQL Editor で全文を実行

create table if not exists public.reservations (
  id text primary key,
  customer_name text not null,
  customer_contact text not null,
  stylist_id text not null,
  store_id text not null,
  menu text not null,
  desired_date_time text not null,
  channel text not null check (channel in ('web', 'line')),
  status text not null check (status in ('confirmed', 'pending', 'rejected')),
  salonboard_status text not null check (salonboard_status in ('reserved', 'unavailable', 'pending', 'failed')),
  salonboard_booking_id text,
  salonboard_synced_at timestamptz,
  salonboard_error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_reservations_created_at on public.reservations (created_at desc);

create table if not exists public.salonboard_bookings (
  booking_id text primary key,
  shop_id text not null,
  date_time text not null,
  stylist_name text not null,
  customer_name text not null,
  customer_contact text not null,
  menu text not null,
  created_at timestamptz default now()
);

create index if not exists idx_sb_shop_dt on public.salonboard_bookings (shop_id, date_time);

-- MVP モック前提: RLS は無効化（誰でも読み書き可能）。
-- 本番化時は RLS を有効にし、認証ロール別のポリシーを設定すること。
alter table public.reservations disable row level security;
alter table public.salonboard_bookings disable row level security;

-- anon / authenticated ロールへ権限を付与（RLS 無効でも GRANT は別途必要）
grant select, insert, update, delete on public.reservations to anon, authenticated;
grant select, insert, update, delete on public.salonboard_bookings to anon, authenticated;

-- PostgREST のスキーマキャッシュをリロード
notify pgrst, 'reload schema';
