-- Migration 002: reservations.menu (text) を menus (text[]) + duration_minutes に変更
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）

-- 1. 新カラムを追加
alter table public.reservations
  add column if not exists menus text[] default '{}',
  add column if not exists duration_minutes integer default 60;

-- 2. 既存 menu(text) を menus(text[]) に移行（既存予約があれば）
update public.reservations
set menus = array[menu]
where menu is not null and array_length(menus, 1) is null;

-- 3. menus を NOT NULL に
alter table public.reservations
  alter column menus set not null,
  alter column duration_minutes set not null;

-- 4. 旧 menu カラムを削除
alter table public.reservations drop column if exists menu;

-- 5. PostgREST のスキーマキャッシュをリロード
notify pgrst, 'reload schema';
