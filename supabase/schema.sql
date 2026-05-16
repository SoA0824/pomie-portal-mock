-- POMiE Portal Mock — Supabase スキーマ
-- 適用方法: Supabase Studio の SQL Editor で全文を実行

create table if not exists public.reservations (
  id text primary key,
  customer_name text not null,
  customer_contact text not null,
  stylist_id text not null,
  store_id text not null,
  menus text[] not null default '{}',
  duration_minutes integer not null default 60,
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

-- ============================================================
-- 美容師 + SNS投稿
-- ============================================================
create table if not exists public.stylists (
  id text primary key,
  name text not null,
  name_kana text,
  avatar text,
  profile text not null,
  store_id text not null,
  area text,
  strengths text[] not null default '{}',
  specialty_menus text[] not null default '{}',
  menus jsonb not null default '[]'::jsonb,
  price_range jsonb not null,
  available_time_slots text[] not null default '{}',
  instagram_handle text,
  sns_links jsonb not null default '{}'::jsonb,
  contract_status text not null check (contract_status in ('active', 'inactive')),
  featured_flag boolean not null default false,
  rating numeric(2,1) not null default 0,
  works_count integer not null default 0,
  instagram_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_stylists_store on public.stylists (store_id);
create index if not exists idx_stylists_contract on public.stylists (contract_status);

create table if not exists public.sns_posts (
  id text primary key,
  stylist_id text not null references public.stylists(id) on delete cascade,
  platform text not null,
  image_url text not null,
  caption text not null,
  posted_at timestamptz not null,
  source_url text,
  external_id text,
  fetched_at timestamptz default now()
);

create index if not exists idx_sns_posts_stylist on public.sns_posts (stylist_id, posted_at desc);

-- MVP モック前提: RLS は無効化（誰でも読み書き可能）。
-- 本番化時は RLS を有効にし、認証ロール別のポリシーを設定すること。
alter table public.reservations disable row level security;
alter table public.salonboard_bookings disable row level security;
alter table public.stylists disable row level security;
alter table public.sns_posts disable row level security;

-- anon / authenticated ロールへ権限を付与（RLS 無効でも GRANT は別途必要）
grant select, insert, update, delete on public.reservations to anon, authenticated;
grant select, insert, update, delete on public.salonboard_bookings to anon, authenticated;
grant select, insert, update, delete on public.stylists to anon, authenticated;
grant select, insert, update, delete on public.sns_posts to anon, authenticated;

-- PostgREST のスキーマキャッシュをリロード
notify pgrst, 'reload schema';
