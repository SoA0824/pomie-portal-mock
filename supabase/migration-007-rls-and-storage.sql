-- Migration 007: RLS の修復 + 画像アップロード用 Storage バケット作成
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）
--
-- 症状: 美容師の保存時に
--   new row violates row-level security policy for table "stylists"
-- が出る場合、RLS が有効なのにポリシーが無い状態。

-- ============================================================
-- 1. RLS を無効化（MVP / テスト運用フェーズの前提）
-- ============================================================
-- 本番で実顧客を扱う前に、RLS 有効化 + Supabase Auth への移行が必要。
alter table public.stylists            disable row level security;
alter table public.sns_posts           disable row level security;
alter table public.reservations        disable row level security;
alter table public.salonboard_bookings disable row level security;

-- 権限も念のため付与し直す
grant select, insert, update, delete on public.stylists            to anon, authenticated;
grant select, insert, update, delete on public.sns_posts           to anon, authenticated;
grant select, insert, update, delete on public.reservations        to anon, authenticated;
grant select, insert, update, delete on public.salonboard_bookings to anon, authenticated;

-- ============================================================
-- 2. 画像アップロード用の Storage バケット
-- ============================================================
-- public = true … 誰でも画像を閲覧できる（公開サイトに載せるため）
-- file_size_limit … 10MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stylist-images',
  'stylist-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- バケットへのアクセスポリシー（既存なら作り直し）
drop policy if exists "stylist-images public read"   on storage.objects;
drop policy if exists "stylist-images anon insert"   on storage.objects;
drop policy if exists "stylist-images anon update"   on storage.objects;
drop policy if exists "stylist-images anon delete"   on storage.objects;

create policy "stylist-images public read"
  on storage.objects for select
  using (bucket_id = 'stylist-images');

create policy "stylist-images anon insert"
  on storage.objects for insert
  with check (bucket_id = 'stylist-images');

create policy "stylist-images anon update"
  on storage.objects for update
  using (bucket_id = 'stylist-images');

create policy "stylist-images anon delete"
  on storage.objects for delete
  using (bucket_id = 'stylist-images');

notify pgrst, 'reload schema';
