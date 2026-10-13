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
  background_image text,
  booking_mode text not null default 'external' check (booking_mode in ('pomie', 'external')),
  booking_links jsonb not null default '[]'::jsonb,
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

create table if not exists public.articles (
  id text primary key,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  body text not null default '',
  category text not null,
  cover_image text not null default '',
  related_stylist_ids text[] not null default '{}',
  -- draft: 下書き（非公開） / published: 公開
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- 狙う検索キーワード（記事の自動執筆・効果測定で使う）
  target_keyword text,
  -- manual: 手書き / ai: 自動執筆
  source text not null default 'manual' check (source in ('manual', 'ai')),
  published_at timestamptz,
  supervisor_stylist_id text,
  supervisor_name text,
  supervisor_title text,
  keyword_candidate_id text,
  generation_log jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_status_published
  on public.articles (status, published_at desc);

-- 記事化するキーワードの候補。自動提案されたものを管理者が承認・却下する
create table if not exists public.keyword_candidates (
  id text primary key,
  keyword text not null unique,
  -- 元になった種キーワード
  seed text,
  search_volume integer,
  seo_difficulty integer,
  competition integer,
  cpc numeric,
  -- booking: 予約に近い / compare: 比較・検討 / info: 情報収集
  intent text,
  -- 記事の企画案（タイトル・切り口・カテゴリ・紹介する美容師）
  category text,
  suggested_title text,
  angle text,
  faq_questions text[] not null default '{}',
  related_keywords jsonb not null default '[]'::jsonb,
  target_stylist_ids text[] not null default '{}',
  score numeric,
  reason text,
  -- proposed: 提案中 / approved: 承認（記事化待ち）/ rejected: 却下 /
  -- writing: 記事化中 / written: 記事化済み / failed: 記事化に失敗
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'writing', 'written', 'failed')),
  -- 管理者のメモ（承認時の指示。記事化のときにそのまま渡される）
  note text,
  article_id text,
  error text,
  proposed_at timestamptz not null default now(),
  decided_at timestamptz,
  written_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_keyword_candidates_status
  on public.keyword_candidates (status, score desc);

-- 候補を探すときの種キーワード（管理者が追加できる。無ければ美容師の情報から自動で作られる）
create table if not exists public.keyword_seeds (
  id text primary key,
  keyword text not null unique,
  enabled boolean not null default true,
  note text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- 記事: 監修者（美容師を選ぶ、またはその他の名前と肩書）・生成元・生成ログ
alter table public.articles
  add column if not exists supervisor_stylist_id text,
  add column if not exists supervisor_name text,
  add column if not exists supervisor_title text,
  add column if not exists keyword_candidate_id text,
  add column if not exists generation_log jsonb;

-- MVP モック前提: RLS は無効化（誰でも読み書き可能）。
-- 本番化時は RLS を有効にし、認証ロール別のポリシーを設定すること。
alter table public.reservations disable row level security;
alter table public.salonboard_bookings disable row level security;
alter table public.stylists disable row level security;
alter table public.sns_posts disable row level security;
alter table public.articles disable row level security;
alter table public.keyword_candidates disable row level security;
alter table public.keyword_seeds disable row level security;

-- anon / authenticated ロールへ権限を付与（RLS 無効でも GRANT は別途必要）
grant select, insert, update, delete on public.reservations to anon, authenticated;
grant select, insert, update, delete on public.salonboard_bookings to anon, authenticated;
grant select, insert, update, delete on public.stylists to anon, authenticated;
grant select, insert, update, delete on public.sns_posts to anon, authenticated;
grant select, insert, update, delete on public.articles to anon, authenticated;
grant select, insert, update, delete on public.keyword_candidates to anon, authenticated;
grant select, insert, update, delete on public.keyword_seeds to anon, authenticated;

-- PostgREST のスキーマキャッシュをリロード
notify pgrst, 'reload schema';
