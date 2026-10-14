-- Migration 010: 新しく作ったテーブルの RLS（行レベルセキュリティ）を無効化し直す
-- 適用方法: Supabase SQL Editor で全文を Run（何度実行しても安全）
--
-- 症状:
--   - 書き込み時に "new row violates row-level security policy for table ..." が出る
--   - 読み取りはエラーにならず 0 件になる（管理画面で記事や候補が表示されない）
-- 原因:
--   Supabase のプロジェクト設定「Enable automatic RLS」により、新しく作ったテーブルに
--   RLS が自動で有効化されている（ポリシーが無いため全件拒否になる）。
--
-- MVP / テスト運用フェーズの前提（他のテーブルと同じ）: RLS 無効 + anon に権限付与。
-- 本番で実顧客を扱う前に、RLS 有効化 + Supabase Auth への移行が必要。

alter table public.articles            disable row level security;
alter table public.keyword_candidates  disable row level security;
alter table public.keyword_seeds       disable row level security;
alter table public.stylists            disable row level security;
alter table public.sns_posts           disable row level security;
alter table public.reservations        disable row level security;
alter table public.salonboard_bookings disable row level security;

grant select, insert, update, delete on public.articles            to anon, authenticated;
grant select, insert, update, delete on public.keyword_candidates  to anon, authenticated;
grant select, insert, update, delete on public.keyword_seeds       to anon, authenticated;
grant select, insert, update, delete on public.stylists            to anon, authenticated;
grant select, insert, update, delete on public.sns_posts           to anon, authenticated;
grant select, insert, update, delete on public.reservations        to anon, authenticated;
grant select, insert, update, delete on public.salonboard_bookings to anon, authenticated;

notify pgrst, 'reload schema';

-- 確認: すべて rls_enabled = false になっていれば OK
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('articles', 'keyword_candidates', 'keyword_seeds', 'stylists',
                    'sns_posts', 'reservations', 'salonboard_bookings')
order by c.relname;
