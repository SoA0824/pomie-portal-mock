-- 診断用: RLS の有効/無効と Storage バケットの状態を確認する
-- Supabase SQL Editor で実行（データは変更しません）

-- 1. 各テーブルの RLS 状態
--    rls_enabled が true の行があると、その表への書き込みで
--    "new row violates row-level security policy" が発生する。
select
  c.relname            as table_name,
  c.relrowsecurity     as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('stylists', 'sns_posts', 'reservations', 'salonboard_bookings')
order by c.relname;

-- 2. 画像アップロード用バケットが存在するか
--    0 行なら migration-007 未実行。
select id, name, public, file_size_limit
from storage.buckets
where id = 'stylist-images';

-- 3. stylists に必要なカラムが揃っているか
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'stylists'
  and column_name in ('background_image', 'booking_mode', 'booking_links', 'strengths', 'specialty_menus')
order by column_name;
