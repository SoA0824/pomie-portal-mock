-- Migration 003: 「強み」と「得意メニュー（表示用）」を予約メニューから分離
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）

-- 1. 新カラムを追加
alter table public.stylists
  add column if not exists strengths text[] not null default '{}',
  add column if not exists specialty_menus text[] not null default '{}';

-- 2. 既存行: specialty_menus が未設定なら、bookable menus の name を流用しておく
update public.stylists
set specialty_menus = coalesce(
  (select array_agg(elem->>'name') from jsonb_array_elements(menus) elem),
  '{}'::text[]
)
where array_length(specialty_menus, 1) is null;

-- 3. PostgREST のスキーマキャッシュをリロード
notify pgrst, 'reload schema';
