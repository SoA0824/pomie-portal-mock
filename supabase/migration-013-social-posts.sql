-- ============================================================
-- migration-013: SNS 投稿（記事をもとにした Instagram / X 向けの投稿文と画像）
-- ============================================================
-- 実行: Supabase の SQL Editor に貼り付けて Run（2 回実行しても安全）
--
-- 流れ: 管理画面で依頼 → Claude Code の /make-social-post が投稿文・スライド・画像を作る（下書き）
--       → 管理画面で確認・修正 → 「書き出す」で文字を合成した最終画像を作る → 手動で投稿 → 投稿済みにする

create table if not exists public.social_posts (
  id text primary key,
  article_id text not null,
  -- 出す媒体（instagram / x）。文章は媒体ごと、画像は共通
  platforms text[] not null default '{instagram,x}',
  format text not null default 'carousel' check (format in ('carousel', 'single', 'story')),
  status text not null default 'requested'
    check (status in ('requested', 'draft', 'ready', 'posted', 'rejected', 'failed')),
  -- 依頼時のひとこと指示
  brief text not null default '',
  -- スライドの見た目（photo = 写真＋文字 / cream = クリーム地）
  template text not null default 'photo',
  -- Instagram 用
  caption text,
  hashtags text[] not null default '{}',
  alt_text text,
  -- X 用（本文と、記事リンクを載せる返信）
  x_text text,
  x_reply text,
  -- スライド [{ kind, headline, body, image_source, image_prompt, image_url, template }]
  slides jsonb not null default '[]'::jsonb,
  image_provider text,
  image_model text,
  raw_image_urls text[] not null default '{}',
  -- 文字を合成した最終画像（書き出し済み）
  rendered_urls text[] not null default '{}',
  rendered_at timestamptz,
  -- 管理画面からの「画像の作り直し」の指示
  image_request text,
  -- 美容師本人の写真を使う場合の了承メモ
  photo_consent text,
  lint jsonb,
  generation_log jsonb,
  error text,
  -- 投稿の記録 { instagram: { at, url }, x: { at, url } }
  posted jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_posts_article on public.social_posts (article_id);
create index if not exists idx_social_posts_status on public.social_posts (status);

-- 他のテーブルと同じく RLS は使わない（管理画面は Basic 認証で保護）
alter table public.social_posts disable row level security;
grant select, insert, update, delete on public.social_posts to anon, authenticated;

-- ------------------------------------------------------------
-- 画像の保存先（公開バケット。投稿用の画像は公開 URL が必要）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-images',
  'social-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "social-images public read" on storage.objects;
drop policy if exists "social-images anon insert" on storage.objects;
drop policy if exists "social-images anon update" on storage.objects;
drop policy if exists "social-images anon delete" on storage.objects;

create policy "social-images public read"
  on storage.objects for select
  using (bucket_id = 'social-images');

create policy "social-images anon insert"
  on storage.objects for insert
  with check (bucket_id = 'social-images');

create policy "social-images anon update"
  on storage.objects for update
  using (bucket_id = 'social-images');

create policy "social-images anon delete"
  on storage.objects for delete
  using (bucket_id = 'social-images');

notify pgrst, 'reload schema';

-- 確認（rls_enabled が f なら OK）
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'social_posts';
