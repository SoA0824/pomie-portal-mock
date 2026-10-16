-- Migration 011: 記事にエリア（タグ）を持たせる
-- 適用方法: Supabase SQL Editor で全文を Run（何度実行しても安全）
--
-- エリア一覧ページ /articles/omotesando などで使う。1 本の記事に複数のエリアを付けられる。
-- 値はエリアの英字 slug（omotesando / ebisu。src/lib/areas.ts と同じ）。

alter table public.articles
  add column if not exists areas text[] not null default '{}';

-- 既存の記事に、キーワードとタイトルからエリアを付ける（まだ付いていない記事だけ）
update public.articles
set areas = array_remove(array[
      case when (coalesce(target_keyword, '') || title) like '%表参道%' then 'omotesando' end,
      case when (coalesce(target_keyword, '') || title) like '%恵比寿%' then 'ebisu' end
    ], null)
where areas = '{}';

-- 新しい列にも RLS 無効 + 権限の前提はそのまま（テーブル単位の設定のため追加作業なし）
notify pgrst, 'reload schema';

-- 確認
select slug, title, areas from public.articles order by updated_at desc;
