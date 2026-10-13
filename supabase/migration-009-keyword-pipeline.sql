-- Migration 009: キーワード選定の自動化（候補の提案 → 承認 → 記事化）と記事の監修者
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）

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

-- MVP / テスト運用フェーズの前提: RLS 無効 + anon に権限付与（他テーブルと同じ）
alter table public.keyword_candidates disable row level security;
alter table public.keyword_seeds disable row level security;
grant select, insert, update, delete on public.keyword_candidates to anon, authenticated;
grant select, insert, update, delete on public.keyword_seeds to anon, authenticated;

notify pgrst, 'reload schema';
