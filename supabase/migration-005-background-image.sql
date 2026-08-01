-- Migration 005: 美容師詳細ページのヒーロー背景画像を個別設定できるように
-- 適用方法: Supabase SQL Editor で全文を Run（1 回だけ）

alter table public.stylists
  add column if not exists background_image text;

notify pgrst, 'reload schema';
