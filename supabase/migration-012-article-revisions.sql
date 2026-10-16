-- Migration 012: 記事のリライト（依頼 → 提案 → 承認して反映）
-- 適用方法: Supabase SQL Editor で全文を Run（何度実行しても安全）
--
-- 公開中の記事は直接書き換えず、リライト案を「提案」として保存し、
-- 管理者が差分を確認して承認したときだけ記事に反映する。

create table if not exists public.article_revisions (
  id text primary key,
  article_id text not null,
  -- requested: 依頼済み（リライト待ち）/ proposed: 提案あり（承認待ち）/
  -- applied: 反映済み / rejected: 却下 / failed: リライトに失敗
  status text not null default 'requested'
    check (status in ('requested', 'proposed', 'applied', 'rejected', 'failed')),
  -- 管理者の指示（自由記述）
  instruction text not null default '',
  -- 美容師の差し替え指示 { "remove": ["st-..."], "add": ["st-..."] }
  stylist_swap jsonb not null default '{}'::jsonb,
  -- 分析結果と変更点の要約（リライトした側が書く）
  analysis text,
  change_summary text,
  -- 提案内容（記事の URL＝slug は変えない）
  proposed_title text,
  proposed_summary text,
  proposed_body text,
  proposed_category text,
  proposed_related_stylist_ids text[],
  proposed_areas text[],
  -- 提案を作った時点の記事の更新日時（反映時に、その後の手動編集とぶつからないか確認する）
  base_updated_at timestamptz,
  lint jsonb,
  error text,
  requested_at timestamptz not null default now(),
  proposed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_article_revisions_article on public.article_revisions (article_id, created_at desc);
create index if not exists idx_article_revisions_status on public.article_revisions (status);

-- MVP / テスト運用フェーズの前提（他のテーブルと同じ）: RLS 無効 + anon に権限付与
alter table public.article_revisions disable row level security;
grant select, insert, update, delete on public.article_revisions to anon, authenticated;

notify pgrst, 'reload schema';

-- 確認（rls_enabled が false なら OK）
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'article_revisions';
