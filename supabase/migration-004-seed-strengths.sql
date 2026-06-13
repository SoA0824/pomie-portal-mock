-- Migration 004: 既存シード美容師 12 名に「強み」をまとめて投入
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）
--
-- 既に何か入っている美容師は上書きしない（`array_length(strengths, 1) is null` で空配列のみ対象）

update public.stylists set strengths = array['髪質改善のプロ','ダメージレス施術','扱いやすい仕上がり']::text[] where id = 'st-01' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['メンズスタイル専門','外国人風カラー','再現性重視']::text[] where id = 'st-02' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['似合わせカット','顔タイプ診断対応','30〜40代女性に人気']::text[] where id = 'st-03' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['メンズスタイル専門','韓国スタイル','20代男性に人気']::text[] where id = 'st-04' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['ハイトーンカラー得意']::text[] where id = 'st-05' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['ショート・ボブ専門','30〜40代女性に人気','白髪ぼかし']::text[] where id = 'st-06' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['ブライダル特化','顔タイプ診断対応','ナチュラル系']::text[] where id = 'st-07' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['髪質改善のプロ','頭皮ケア・スパ','再現性重視']::text[] where id = 'st-08' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['メンズスタイル専門']::text[] where id = 'st-09' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['ハイトーンカラー得意','外国人風カラー','デザインカット']::text[] where id = 'st-10' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['ロングヘア専門','扱いやすい仕上がり','再現性重視']::text[] where id = 'st-11' and array_length(strengths, 1) is null;
update public.stylists set strengths = array['扱いやすい仕上がり']::text[] where id = 'st-12' and array_length(strengths, 1) is null;

notify pgrst, 'reload schema';
