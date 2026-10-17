-- Migration 016: 外部美容師（POMiE と契約していないフリーランス美容師）の掲載に対応
-- 適用方法: Supabase SQL Editor で全文を Run（何度実行しても安全）
--
-- affiliation: pomie = POMiE の店舗に在籍 / external = 他サロンで活動するフリーランス
-- external_salon_name: 外部美容師の所属サロン名（店名のみ表示する）
-- external_booking_enabled: 外部美容師に予約ボタンを表示するか（オプション。POMiE の美容師は常に表示）

alter table public.stylists
  add column if not exists affiliation text not null default 'pomie',
  add column if not exists external_salon_name text,
  add column if not exists external_booking_enabled boolean not null default false;

-- 外部美容師は POMiE の店舗に属さないので、店舗 ID を必須でなくす
alter table public.stylists alter column store_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stylists_affiliation_check') then
    alter table public.stylists
      add constraint stylists_affiliation_check check (affiliation in ('pomie', 'external'));
  end if;
  -- POMiE の美容師は店舗が必須、外部美容師はサロン名が必須
  if not exists (select 1 from pg_constraint where conname = 'stylists_affiliation_fields_check') then
    alter table public.stylists
      add constraint stylists_affiliation_fields_check check (
        (affiliation = 'pomie' and store_id is not null)
        or (affiliation = 'external' and coalesce(btrim(external_salon_name), '') <> '')
      );
  end if;
end $$;

notify pgrst, 'reload schema';
