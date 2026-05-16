-- 自動生成: scripts/generate-seed-sql.mjs から
-- 適用方法: Supabase Studio の SQL Editor でこのファイル全文を Run

-- ===== stylists (12 名) =====
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-01',
  '北川 美咲',
  'キタガワ ミサキ',
  'https://picsum.photos/seed/st-01/300/300',
  '髪質改善ストレート歴12年。ダメージレスな艶髪づくりが得意です。お客様一人ひとりの毛流れに合わせた施術で、扱いやすく長持ちする仕上がりをお届けします。',
  's1',
  '表参道',
  '[{"name":"髪質改善","duration":120},{"name":"縮毛矯正","duration":180},{"name":"カラー","duration":90},{"name":"トリートメント","duration":60}]'::jsonb,
  '{"min":9000,"max":28000}'::jsonb,
  ARRAY['2026-05-10T10:00','2026-05-10T14:00','2026-05-11T11:00','2026-05-12T10:00','2026-05-12T16:00','2026-05-13T13:00','2026-05-14T10:00','2026-05-15T15:00']::text[],
  'misaki_kitagawa',
  '{"instagram":"https://instagram.com/misaki_kitagawa","tiktok":"https://tiktok.com/@misaki_pomie"}'::jsonb,
  'active',
  true,
  4.9,
  482
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-02',
  '大野 涼太',
  'オオノ リョウタ',
  'https://picsum.photos/seed/st-02/300/300',
  'メンズカット・デザインカラー専門。ビジネスからストリートまで幅広いスタイルに対応。骨格と髪質を見極めた立体カットで「再現性の高い」ヘアを提供します。',
  's1',
  '表参道',
  '[{"name":"メンズカット","duration":60},{"name":"デザインカラー","duration":90},{"name":"ハイライト","duration":150},{"name":"パーマ","duration":120}]'::jsonb,
  '{"min":6500,"max":18000}'::jsonb,
  ARRAY['2026-05-10T11:00','2026-05-10T15:00','2026-05-11T10:00','2026-05-11T17:00','2026-05-12T13:00','2026-05-13T11:00','2026-05-14T16:00','2026-05-16T14:00']::text[],
  'ryota_pomie',
  '{"instagram":"https://instagram.com/ryota_pomie","x":"https://x.com/ryota_pomie"}'::jsonb,
  'active',
  true,
  4.8,
  365
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-03',
  '吉田 さくら',
  'ヨシダ サクラ',
  'https://picsum.photos/seed/st-03/300/300',
  '似合わせカット・パーソナルカラー診断。骨格 × 顔タイプ × 似合うカラーで「自分史上いちばん」のヘアに導きます。',
  's1',
  '表参道',
  '[{"name":"カット","duration":60},{"name":"似合わせカラー","duration":90},{"name":"パーソナルカラー","duration":90},{"name":"ボブ","duration":75}]'::jsonb,
  '{"min":7500,"max":22000}'::jsonb,
  ARRAY['2026-05-10T13:00','2026-05-11T14:00','2026-05-12T11:00','2026-05-13T10:00','2026-05-14T13:00','2026-05-15T11:00']::text[],
  'sakura_pomie',
  '{"instagram":"https://instagram.com/sakura_pomie"}'::jsonb,
  'active',
  true,
  4.9,
  521
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-04',
  '高橋 蓮',
  'タカハシ レン',
  'https://picsum.photos/seed/st-04/300/300',
  'メンズパーマ・ツイストスパイラルが得意。ライフスタイルに合わせて朝のセットが楽になるカットをご提案します。',
  's1',
  '表参道',
  '[{"name":"メンズカット","duration":60},{"name":"パーマ","duration":120},{"name":"ツイストスパイラル","duration":120},{"name":"ヘッドスパ","duration":60}]'::jsonb,
  '{"min":6000,"max":16000}'::jsonb,
  ARRAY['2026-05-10T16:00','2026-05-11T13:00','2026-05-12T15:00','2026-05-13T17:00','2026-05-14T11:00','2026-05-16T13:00']::text[],
  'ren_pomie',
  '{"instagram":"https://instagram.com/ren_pomie","tiktok":"https://tiktok.com/@ren_pomie"}'::jsonb,
  'active',
  false,
  4.7,
  248
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-05',
  '山本 葵',
  'ヤマモト アオイ',
  'https://picsum.photos/seed/st-05/300/300',
  'ハイライト・バレイヤージュなど外国人風カラーを得意としていました。',
  's1',
  '表参道',
  '[{"name":"カラー","duration":90},{"name":"ハイライト","duration":150},{"name":"バレイヤージュ","duration":180}]'::jsonb,
  '{"min":8000,"max":24000}'::jsonb,
  ARRAY[]::text[],
  'aoi_pomie',
  '{"instagram":"https://instagram.com/aoi_pomie"}'::jsonb,
  'inactive',
  false,
  4.6,
  198
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-06',
  '渡辺 結菜',
  'ワタナベ ユイナ',
  'https://picsum.photos/seed/st-06/300/300',
  'ボブ・ショートでお顔まわりを綺麗に魅せる小顔ヘアが得意です。30〜40代女性のお客様に多くご支持いただいています。',
  's1',
  '表参道',
  '[{"name":"カット","duration":60},{"name":"ボブ","duration":75},{"name":"ショート","duration":75},{"name":"白髪ぼかし","duration":90}]'::jsonb,
  '{"min":7000,"max":20000}'::jsonb,
  ARRAY['2026-05-10T12:00','2026-05-11T15:00','2026-05-12T14:00','2026-05-13T16:00','2026-05-14T15:00','2026-05-15T13:00','2026-05-16T11:00']::text[],
  'yuina_pomie',
  '{"instagram":"https://instagram.com/yuina_pomie"}'::jsonb,
  'active',
  false,
  4.8,
  312
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-07',
  '藤井 響',
  'フジイ ヒビキ',
  'https://picsum.photos/seed/st-07/300/300',
  'ブライダル・パーティーヘアセットの専門。お客様の挙式や記念日を「最高の一日」にする一手を担います。',
  's2',
  '恵比寿',
  '[{"name":"ヘアセット","duration":60},{"name":"アップスタイル","duration":60},{"name":"ブライダル","duration":120},{"name":"編み込み","duration":60}]'::jsonb,
  '{"min":8000,"max":32000}'::jsonb,
  ARRAY['2026-05-10T09:00','2026-05-11T09:00','2026-05-12T09:00','2026-05-13T09:00','2026-05-14T09:00','2026-05-15T09:00']::text[],
  'hibiki_pomie',
  '{"instagram":"https://instagram.com/hibiki_pomie","tiktok":"https://tiktok.com/@hibiki_pomie"}'::jsonb,
  'active',
  true,
  4.9,
  612
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-08',
  '小川 美月',
  'オガワ ミヅキ',
  'https://picsum.photos/seed/st-08/300/300',
  '髪質改善トリートメント専門。生まれ持った髪を最大限に活かす施術と、再現性ある提案でリピート率No.1。',
  's2',
  '恵比寿',
  '[{"name":"トリートメント","duration":60},{"name":"髪質改善","duration":120},{"name":"ヘッドスパ","duration":60}]'::jsonb,
  '{"min":7500,"max":22000}'::jsonb,
  ARRAY['2026-05-10T10:30','2026-05-11T12:00','2026-05-12T17:00','2026-05-13T14:00','2026-05-14T17:00','2026-05-16T10:00']::text[],
  'mizuki_pomie',
  '{"instagram":"https://instagram.com/mizuki_pomie"}'::jsonb,
  'active',
  false,
  4.8,
  287
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-09',
  '佐藤 駿',
  'サトウ シュン',
  'https://picsum.photos/seed/st-09/300/300',
  'メンズカット中心に活動していました。',
  's2',
  '恵比寿',
  '[{"name":"メンズカット","duration":60},{"name":"カラー","duration":90}]'::jsonb,
  '{"min":6500,"max":14000}'::jsonb,
  ARRAY[]::text[],
  null,
  '{}'::jsonb,
  'inactive',
  false,
  4.4,
  102
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-10',
  '鈴木 里奈',
  'スズキ リナ',
  'https://picsum.photos/seed/st-10/300/300',
  'ハイライト・バレイヤージュなど立体カラーが得意。ブリーチありもなしも、髪のコンディションを見ながら最適解を提案します。',
  's2',
  '恵比寿',
  '[{"name":"カラー","duration":90},{"name":"ハイライト","duration":150},{"name":"バレイヤージュ","duration":180},{"name":"デザインカラー","duration":90}]'::jsonb,
  '{"min":9000,"max":26000}'::jsonb,
  ARRAY['2026-05-10T11:30','2026-05-11T16:00','2026-05-12T12:00','2026-05-13T15:00','2026-05-14T12:00','2026-05-15T16:00','2026-05-16T15:00']::text[],
  'rina_pomie',
  '{"instagram":"https://instagram.com/rina_pomie","x":"https://x.com/rina_pomie"}'::jsonb,
  'active',
  true,
  4.8,
  398
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-11',
  '中村 颯',
  'ナカムラ ハヤテ',
  'https://picsum.photos/seed/st-11/300/300',
  'ロングヘア・デジタルパーマ専門。柔らかく動きのあるカールで、扱いやすいスタイルに仕上げます。',
  's2',
  '恵比寿',
  '[{"name":"ロング","duration":75},{"name":"デジタルパーマ","duration":120},{"name":"カット","duration":60},{"name":"コテ巻き風パーマ","duration":120}]'::jsonb,
  '{"min":7000,"max":20000}'::jsonb,
  ARRAY['2026-05-10T17:00','2026-05-11T11:00','2026-05-12T16:00','2026-05-13T11:30','2026-05-14T14:00','2026-05-15T17:00']::text[],
  'hayate_pomie',
  '{"instagram":"https://instagram.com/hayate_pomie"}'::jsonb,
  'active',
  false,
  4.7,
  256
) on conflict (id) do nothing;
insert into public.stylists (id, name, name_kana, avatar, profile, store_id, area, menus, price_range, available_time_slots, instagram_handle, sns_links, contract_status, featured_flag, rating, works_count) values (
  'st-12',
  '林 千夏',
  'ハヤシ チナツ',
  'https://picsum.photos/seed/st-12/300/300',
  'カット・カラー全般を担当していました。',
  's2',
  '恵比寿',
  '[{"name":"カット","duration":60},{"name":"カラー","duration":90}]'::jsonb,
  '{"min":6000,"max":14000}'::jsonb,
  ARRAY[]::text[],
  null,
  '{}'::jsonb,
  'inactive',
  false,
  4.5,
  145
) on conflict (id) do nothing;

-- ===== sns_posts (32 件) =====
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-01-1',
  'st-01',
  'instagram',
  'https://picsum.photos/seed/p-01-1/600/600',
  '髪質改善ストレート×艶カラー。広がりやすい髪も内側からまとまる仕上がりに。',
  '2026-05-07T10:00',
  'p-01-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-01-2',
  'st-01',
  'instagram',
  'https://picsum.photos/seed/p-01-2/600/600',
  'ダメージレス縮毛矯正で「自然な毛流れ」をデザイン。3ヶ月後もまとまります。',
  '2026-05-04T18:30',
  'p-01-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-01-3',
  'st-01',
  'tiktok',
  'https://picsum.photos/seed/p-01-3/600/600',
  'before / after 動画。うねり髪→ツヤ髪のリアル比較。',
  '2026-05-01T12:00',
  'p-01-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-01-4',
  'st-01',
  'instagram',
  'https://picsum.photos/seed/p-01-4/600/600',
  '梅雨に向けて。広がる髪をどうにかしたい方へおすすめのメニュー。',
  '2026-04-26T09:00',
  'p-01-4'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-02-1',
  'st-02',
  'instagram',
  'https://picsum.photos/seed/p-02-1/600/600',
  'ビジネス対応のセンターパート×ブルーアッシュ。',
  '2026-05-08T20:00',
  'p-02-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-02-2',
  'st-02',
  'x',
  'https://picsum.photos/seed/p-02-2/600/600',
  'メンズデザインカラーの相談、DMで受け付けています。',
  '2026-05-05T11:00',
  'p-02-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-02-3',
  'st-02',
  'instagram',
  'https://picsum.photos/seed/p-02-3/600/600',
  'ストリート系のマッシュ×ハイライト。色落ちしてもおしゃれに。',
  '2026-05-02T19:00',
  'p-02-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-02-4',
  'st-02',
  'instagram',
  'https://picsum.photos/seed/p-02-4/600/600',
  '似合うパーマ、選び方ガイド。骨格別の提案。',
  '2026-04-28T16:00',
  'p-02-4'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-03-1',
  'st-03',
  'instagram',
  'https://picsum.photos/seed/p-03-1/600/600',
  '似合わせカラー診断×ボブ。30代の方におすすめ。',
  '2026-05-09T09:00',
  'p-03-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-03-2',
  'st-03',
  'instagram',
  'https://picsum.photos/seed/p-03-2/600/600',
  'イエベ春さん向けの艶カラー作例。',
  '2026-05-06T13:00',
  'p-03-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-03-3',
  'st-03',
  'instagram',
  'https://picsum.photos/seed/p-03-3/600/600',
  '顔まわりレイヤーで小顔見せ。お悩み別に提案します。',
  '2026-05-03T10:00',
  'p-03-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-03-4',
  'st-03',
  'instagram',
  'https://picsum.photos/seed/p-03-4/600/600',
  '5月のおすすめメニュー一覧。',
  '2026-04-30T20:00',
  'p-03-4'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-04-1',
  'st-04',
  'instagram',
  'https://picsum.photos/seed/p-04-1/600/600',
  'ツイストスパイラルパーマ。動きのある毛流れを。',
  '2026-05-08T14:00',
  'p-04-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-04-2',
  'st-04',
  'tiktok',
  'https://picsum.photos/seed/p-04-2/600/600',
  '朝のセット時短ハック。スタイリング動画。',
  '2026-05-04T20:00',
  'p-04-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-04-3',
  'st-04',
  'instagram',
  'https://picsum.photos/seed/p-04-3/600/600',
  '韓国マッシュ×波打ちパーマ。',
  '2026-04-29T18:00',
  'p-04-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-06-1',
  'st-06',
  'instagram',
  'https://picsum.photos/seed/p-06-1/600/600',
  '小顔ボブ×白髪ぼかしハイライト。',
  '2026-05-07T11:00',
  'p-06-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-06-2',
  'st-06',
  'instagram',
  'https://picsum.photos/seed/p-06-2/600/600',
  'ショートが似合わないと思っていた方へ。',
  '2026-05-04T12:30',
  'p-06-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-06-3',
  'st-06',
  'instagram',
  'https://picsum.photos/seed/p-06-3/600/600',
  '40代から始めるボブ。骨格補正カットで美シルエット。',
  '2026-04-30T15:00',
  'p-06-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-07-1',
  'st-07',
  'instagram',
  'https://picsum.photos/seed/p-07-1/600/600',
  'ブライダル前撮りヘアセット。クラシカルな編み込み。',
  '2026-05-08T08:00',
  'p-07-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-07-2',
  'st-07',
  'tiktok',
  'https://picsum.photos/seed/p-07-2/600/600',
  'アップスタイルのプロセス動画。後ろ姿まで美しく。',
  '2026-05-05T17:00',
  'p-07-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-07-3',
  'st-07',
  'instagram',
  'https://picsum.photos/seed/p-07-3/600/600',
  '結婚式お呼ばれヘアの当日予約も受付中。',
  '2026-05-02T10:00',
  'p-07-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-07-4',
  'st-07',
  'instagram',
  'https://picsum.photos/seed/p-07-4/600/600',
  '二次会向け、ハーフアップアレンジ。',
  '2026-04-27T11:00',
  'p-07-4'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-08-1',
  'st-08',
  'instagram',
  'https://picsum.photos/seed/p-08-1/600/600',
  '髪質改善トリートメント。指通りで実感する変化。',
  '2026-05-08T19:00',
  'p-08-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-08-2',
  'st-08',
  'instagram',
  'https://picsum.photos/seed/p-08-2/600/600',
  'ヘッドスパ×トリートメントで頭皮から艶髪に。',
  '2026-05-04T14:00',
  'p-08-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-08-3',
  'st-08',
  'instagram',
  'https://picsum.photos/seed/p-08-3/600/600',
  '髪のお悩み別、おすすめホームケア紹介。',
  '2026-04-29T20:00',
  'p-08-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-10-1',
  'st-10',
  'instagram',
  'https://picsum.photos/seed/p-10-1/600/600',
  'ブリーチオンカラー×バレイヤージュ。透明感マックス。',
  '2026-05-08T16:00',
  'p-10-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-10-2',
  'st-10',
  'instagram',
  'https://picsum.photos/seed/p-10-2/600/600',
  'ハイライト初挑戦の方向けデザイン。',
  '2026-05-05T13:00',
  'p-10-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-10-3',
  'st-10',
  'x',
  'https://picsum.photos/seed/p-10-3/600/600',
  '今月のカラー予約状況のお知らせ。',
  '2026-05-02T09:00',
  'p-10-3'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-10-4',
  'st-10',
  'instagram',
  'https://picsum.photos/seed/p-10-4/600/600',
  'ブリーチなしハイライトで上品なツヤ感。',
  '2026-04-28T18:00',
  'p-10-4'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-11-1',
  'st-11',
  'instagram',
  'https://picsum.photos/seed/p-11-1/600/600',
  'デジタルパーマ×ロング。ふわっとボリュームのある毛先。',
  '2026-05-07T20:00',
  'p-11-1'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-11-2',
  'st-11',
  'instagram',
  'https://picsum.photos/seed/p-11-2/600/600',
  'コテ巻き風パーマで毎朝のセット時短。',
  '2026-05-04T17:00',
  'p-11-2'
) on conflict (id) do nothing;
insert into public.sns_posts (id, stylist_id, platform, image_url, caption, posted_at, external_id) values (
  'p-11-3',
  'st-11',
  'instagram',
  'https://picsum.photos/seed/p-11-3/600/600',
  'ロングヘアの方向けカット相談、随時受付中。',
  '2026-04-30T13:00',
  'p-11-3'
) on conflict (id) do nothing;
