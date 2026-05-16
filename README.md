# POMiE 集客ポータル + LINE Bot 予約連携モック

ポミエ契約美容師向けの「集客ポータル + 予約導線（Web / LINE）+ サロンボード席予約連携」一体型 MVP モック。

## 目的

- 関係者に「事業イメージ」が伝わる動くモックを提供
- 将来の正式実装（Claude による記事自動生成、実 LINE Messaging API、サロンボード本番連携）にスムーズに移行できる構造を確立
- 完成形ではなく **MVP**

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- **Supabase**（予約 + サロンボードモック台帳の保存先）
- ホスティング: Vercel（mixhost のドメインを向ける運用）

## クイックスタート（ローカル開発）

### 1. Supabase プロジェクトを作成

1. https://supabase.com でサインイン → New project
2. プロジェクト名: 任意（例: `pomie-portal-mock`）。リージョンは `Northeast Asia (Tokyo)` 推奨
3. データベースパスワードは控えておく（ローカル開発では基本不要）
4. プロジェクトが立ち上がったら、**SQL Editor** を開き、次の順で実行:
   1. [supabase/schema.sql](./supabase/schema.sql) を貼り付けて Run（テーブル作成 + GRANT）
   2. [supabase/seed.sql](./supabase/seed.sql) を貼り付けて Run（既存 12 名 + 34 投稿の初期データ）
5. **Project Settings → API** から `Project URL` と `anon public` キーをコピー

### 2. ローカルセットアップ

```bash
npm install
cp .env.example .env.local
# .env.local を編集して NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を埋める
npm run dev   # http://localhost:3000
```

ビルド検証:

```bash
npm run build
npm run start
```

## Vercel デプロイ手順（mixhost ドメインで公開）

### 1. GitHub にコードを push

```bash
git init
git add .
git commit -m "initial commit: POMiE portal MVP mock"
# GitHub で空のリポジトリ作成 → 表示された URL を origin に
git remote add origin git@github.com:YOUR_USER/pomie-portal.git
git branch -M main
git push -u origin main
```

> **注意**: `.env.local` は `.gitignore` で除外済み。Supabase キーが GitHub に上がらないことを確認してください。

### 2. Vercel でプロジェクトを作成

1. https://vercel.com でサインイン → **Add New → Project**
2. GitHub 認証 → 上記リポジトリを **Import**
3. Framework Preset は自動検出（Next.js）
4. **Environment Variables** セクションで以下を追加:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon public key |
| `SALONBOARD_DRIVER` | `mock` |

5. **Deploy** をクリック

数分で `https://pomie-portal-xxxxx.vercel.app` のような URL が払い出されます。

### 3. mixhost のドメインを Vercel に向ける

例: `pomie.example.com` を割り当てたい場合（example.com は mixhost 管理）

#### 3-1. Vercel でカスタムドメインを追加

1. Vercel プロジェクト → **Settings → Domains**
2. `pomie.example.com` を追加
3. Vercel が表示する DNS レコード（CNAME 値）を控える（通常 `cname.vercel-dns.com`）

#### 3-2. mixhost cPanel で DNS を設定

1. mixhost にログイン → 対象アカウントの **cPanel** へ
2. **ドメイン → Zone Editor** （または DNS Zone Editor）
3. 対象ドメインの **管理** → **+ CNAME レコードを追加**
4. 設定:
   - **名前**: `pomie`（サブドメイン部分）
   - **CNAME**: Vercel が指定した値（例: `cname.vercel-dns.com.`）
   - **TTL**: 14400 などデフォルトで OK
5. 保存

DNS 反映には 5 分〜数時間かかります。Vercel 側のドメイン設定画面で「Valid Configuration」表示になれば完了。SSL 証明書は Vercel が自動発行します。

> ルートドメイン（`example.com` 自体）を割り当てたい場合は、Vercel が表示する A レコード（IP アドレス）を mixhost の DNS に追加します。

### 4. デプロイ後の確認

- `https://pomie.example.com/` でトップページが見られる
- `/stylists` で美容師一覧、適当なカードから予約まで通せる
- `/admin/reservations` で予約が記録されている（Supabase 連携が効いている）
- Supabase Studio の Table Editor → `reservations` にレコードが見えれば成功

## ディレクトリ概要

```
POMiEポータル/
├── data/                     # 読み取り専用モックデータ (記事/美容師/店舗/SNS投稿)
├── supabase/
│   └── schema.sql            # Supabase テーブル DDL
├── src/
│   ├── app/                  # ページ + API + 管理画面
│   ├── components/
│   ├── lib/
│   │   ├── data/             # 記事/美容師/予約 アクセサ
│   │   ├── supabase/client.ts
│   │   ├── integrations/
│   │   │   ├── salonboard.ts        # アダプタ I/F + ファクトリ
│   │   │   └── salonboard.mock.ts   # Supabase バックモック
│   │   └── types.ts
│   └── server/actions/createReservation.ts
└── .env.example
```

## 主な画面

| URL | 役割 |
|---|---|
| `/` | トップ（ヒーロー / 記事 / 注目美容師 / LINE CTA） |
| `/articles` | 記事一覧（カテゴリ絞り込み） |
| `/articles/[slug]` | 記事詳細 + 関連美容師 |
| `/stylists` | 美容師一覧（メニュー / 店舗 / 評価 / SNS / キーワード絞り込み） |
| `/stylists/[id]` | 美容師詳細 + SNS 投稿 + 予約 CTA |
| `/reservations/new?stylistId=X` | Web 予約フォーム |
| `/reservations/[id]/complete` | 予約完了画面 + サロンボード同期状況 |
| `/line-bot` | LINE Bot 予約のチャット風モック画面 |
| `/admin` | 管理ダッシュボード |
| `/admin/reservations` | 予約一覧（Web/LINE 横断） |
| `/admin/seats` | サロンボードモック台帳 |
| `/admin/stylists` | 美容師一覧（active/inactive 含む） |
| `/admin/articles` | 記事一覧（管理ビュー） |

## 検証シナリオ

1. **動線**: トップ → 記事 → 美容師検索 → 美容師詳細 → 予約 までクリックで遷移
2. **絞り込み**: `/stylists?menu=髪質改善` で件数が 12 → 2 に減る
3. **掲載制限**: `inactive` の 3 名 (st-05 / st-09 / st-12) が `/stylists` に表示されない
4. **Web 予約**: 完了画面で Salonboard 予約 ID が表示され、Supabase の `reservations` / `salonboard_bookings` 両方に行が増える
5. **容量超過**: 同店舗・同時刻に 5 件目を予約 → Salonboard 側で拒否される（既定容量 4）
6. **LINE Bot モック**: `/line-bot` で予約成立。`/admin/reservations` に `channel='line'` で出る
7. **失敗ハンドリング**: ご連絡先に `salonboard-fail` を含めて予約 → ステータス `pending` + `salonboard.status='failed'` で記録される
8. **管理画面**: `/admin` で予約件数、Salonboard 失敗件数、本日予約数が見える

## サロンボード本番連携の差し替え

現実装は `lib/integrations/salonboard.mock.ts`（Supabase に書き込むモック）。本番化では `getSalonboardClient()` ファクトリ（`lib/integrations/salonboard.ts`）の `SALONBOARD_DRIVER` 分岐に実装を追加します。

サロンボードに公式 REST API はないため、本番手段は `mock | csv | rpa | api` のいずれか。詳細は [計画書](../../../../.claude/plans/line-precious-pine.md) §12 参照。

## 美容師の登録と Instagram 連携

### 美容師を新規登録する

1. `https://<デプロイ URL>/admin/stylists` を開く
2. 右上の **「+ 新規登録」** ボタン
3. 必須項目を入力:
   - 名前
   - 所属店舗（プルダウン）
   - プロフィール
   - 得意メニュー（カンマ区切り）
   - 料金（最低・最高）
   - 契約状態（既定: 掲載中）
4. 任意項目:
   - Instagram ハンドル（`@` 不要、例: `jima211`）
   - アバター画像 URL（空欄なら IG ハンドルから自動取得 / unavatar.io 経由）
5. **「登録する」** → 一覧と公開サイト `/stylists` に即時反映

### Instagram 投稿取得（モック / Apify）

既定では **モック投稿**（placeholder 画像 + ダミーキャプション）が登録されます。実際の Instagram 投稿を表示したい場合は **Apify** をセットアップ:

1. https://apify.com でサインアップ（$5/月クレジット同梱の Personal プランで十分）
2. Console → Settings → Integrations → **API tokens** → Create new token
3. Vercel の Environment Variables に `APIFY_API_TOKEN=...` を追加 → Redeploy
4. `/admin/stylists` で各美容師の **「Instagram 更新」** ボタン押下 → 実際の最新 8 投稿に置き換わる

> **注意**: Vercel Hobby プランは Server Action のタイムアウトが 10s。Apify の同期実行は通常 5〜30s かかるため、トークン設定時はタイムアウトする場合があります。Vercel Pro (60s) もしくは「非同期 + ポーリング化」（後続タスク）で対応予定。

### 切り替え（明示指定）

`INSTAGRAM_FETCHER` を環境変数で設定すれば、ドライバを明示指定できます:

- `INSTAGRAM_FETCHER=mock`: モック固定
- `INSTAGRAM_FETCHER=apify`: Apify 固定（トークン必須）
- 未指定: トークンがあれば apify、無ければ mock（自動）

## 既知の制限（MVP スコープ外）

- 認証 / 権限管理（管理画面は無認証 / Supabase RLS は無効化）
- 決済機能
- 完全自動の本番投稿運用（記事は `data/articles.json` 固定）
- 実 LINE Messaging API 接続（Webhook はスタブのみ）
- 同時予約の競合制御（楽観ロックなし）
