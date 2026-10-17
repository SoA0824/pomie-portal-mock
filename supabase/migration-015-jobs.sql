-- ============================================================
-- migration-015: ジョブ（管理画面の「いま実行」やスケジュールから積む仕事）
-- ============================================================
-- 実行: Supabase の SQL Editor に貼り付けて Run（2 回実行しても安全）
--
-- 管理画面はここにジョブを積むだけ。実行は GitHub Actions（.github/workflows/jobs.yml）が
-- 15 分ごと、またはボタンからの即起動で行う。Claude Code のスキルで手動実行してもよい。

create table if not exists public.jobs (
  id text primary key,
  kind text not null check (kind in ('propose', 'write', 'rewrite', 'social', 'social_images')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'canceled')),
  -- 対象（候補 ID / リライト依頼 ID / SNS 投稿 ID。提案は null）
  target_id text,
  params jsonb not null default '{}'::jsonb,
  requested_by text not null default 'admin',
  attempts int not null default 0,
  runner text,
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error text,
  log text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_status_created on public.jobs (status, created_at);
create index if not exists idx_jobs_target on public.jobs (target_id);

alter table public.jobs disable row level security;
grant select, insert, update, delete on public.jobs to anon, authenticated;

notify pgrst, 'reload schema';

-- 確認（rls_enabled が f なら OK）
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'jobs';
