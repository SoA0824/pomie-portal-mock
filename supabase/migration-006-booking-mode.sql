-- Migration 006: 予約受付導線の切り替え（POMiE システム受付 / 美容師独自受付）
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）
--
-- 最終版の LINE / Web 予約導線が完成するまでは、既定を「美容師独自受付」にする。
-- POMiE システムで受け付ける美容師だけ、管理画面から 'pomie' に切り替える運用。

alter table public.stylists
  add column if not exists booking_mode text not null default 'external',
  add column if not exists booking_links jsonb not null default '[]'::jsonb;

-- 値の制約（既に付いている場合はスキップ）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stylists_booking_mode_check'
  ) then
    alter table public.stylists
      add constraint stylists_booking_mode_check
      check (booking_mode in ('pomie', 'external'));
  end if;
end $$;

notify pgrst, 'reload schema';
