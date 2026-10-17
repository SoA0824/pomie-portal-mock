-- ============================================================
-- migration-014: SNS の自動投稿（Instagram / Threads）とトップの固定表示
-- ============================================================
-- 実行: Supabase の SQL Editor に貼り付けて Run（2 回実行しても安全）

-- 1. 記事をトップの一番上に固定する（新しい順の前に、固定した記事を並べる）
alter table public.articles add column if not exists pinned_at timestamptz;
create index if not exists idx_articles_pinned on public.articles (pinned_at desc) where pinned_at is not null;

-- 2. SNS 投稿に Threads 用の本文を追加。既定の媒体に threads を含める
alter table public.social_posts add column if not exists threads_text text;
alter table public.social_posts alter column platforms set default '{instagram,threads,x}';

-- 3. 連携のトークン（Instagram / Threads）
--    トークンはサーバー側の INTEGRATION_SECRET で暗号化して保存する（匿名キーで読めても復号できない）
create table if not exists public.integration_tokens (
  provider text primary key check (provider in ('instagram', 'threads')),
  token_enc text not null,
  account_id text,
  account_name text,
  expires_at timestamptz,
  refreshed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_tokens disable row level security;
grant select, insert, update, delete on public.integration_tokens to anon, authenticated;

notify pgrst, 'reload schema';

-- 確認
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('integration_tokens', 'social_posts', 'articles')
order by 1;
