-- Migration 001: stylists.menus を text[] から jsonb に変換
-- 既存の各メニュー名から既定の施術時間を割り当てる
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）

-- 1. 新カラムを追加
alter table public.stylists
  add column if not exists menus_new jsonb default '[]'::jsonb;

-- 2. 既存 menus（text[]）の各要素を {name, duration} に変換して新カラムへ
update public.stylists
set menus_new = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'name', m,
        'duration', case m
          when 'カット'                  then 60
          when 'メンズカット'             then 60
          when 'ボブ'                    then 75
          when 'ショート'                 then 75
          when 'ロング'                   then 75
          when 'カラー'                   then 90
          when '似合わせカラー'           then 90
          when 'デザインカラー'           then 90
          when 'パーソナルカラー'         then 90
          when 'トリートメント'           then 60
          when 'ヘッドスパ'               then 60
          when '髪質改善'                 then 120
          when '縮毛矯正'                 then 180
          when 'パーマ'                   then 120
          when 'デジタルパーマ'           then 120
          when 'ツイストスパイラル'        then 120
          when 'コテ巻き風パーマ'         then 120
          when 'ハイライト'               then 150
          when 'バレイヤージュ'           then 180
          when 'ヘアセット'               then 60
          when 'アップスタイル'           then 60
          when '編み込み'                 then 60
          when 'ブライダル'               then 120
          when '白髪ぼかし'               then 90
          else 60
        end
      )
    )
    from unnest(menus) as m
  ),
  '[]'::jsonb
);

-- 3. 旧カラムを破棄して新カラムをリネーム
alter table public.stylists drop column menus;
alter table public.stylists rename column menus_new to menus;
alter table public.stylists alter column menus set not null;
alter table public.stylists alter column menus set default '[]'::jsonb;

-- 4. PostgREST のスキーマキャッシュをリロード
notify pgrst, 'reload schema';
