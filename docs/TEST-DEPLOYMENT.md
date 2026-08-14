# テスト運用環境 セットアップ手順

モック環境（`pomie-portal-mock.vercel.app`）はそのまま残し、
テスト運用用に **別の Supabase + 別の Vercel プロジェクト** を立ち上げる手順です。

## 環境の全体像

| | モック（既存・凍結） | テスト運用（これから作る） |
|---|---|---|
| ブランチ | `mock-demo` | `main` |
| Vercel | pomie-portal-mock | pomie-portal-test（新規） |
| Supabase | 既存プロジェクト | 新規プロジェクト |
| データ | ダミー美容師 12 名 | クリーン（実データのみ） |
| 管理画面 | 認証なし | **Basic 認証あり** |

> モック環境は `mock-demo` ブランチに固定されているため、`main` を更新してもモックは変わりません。

---

## Step 1. モック環境を `mock-demo` ブランチに固定する

現在のモック Vercel プロジェクトが `main` を見ていると、今後の変更が反映されてしまいます。追従しないよう切り替えます。

1. Vercel → **pomie-portal-mock** プロジェクト → **Settings** → **Git**
2. **Production Branch** を `main` → **`mock-demo`** に変更 → Save
3. **Deployments** タブ → 「Redeploy」で `mock-demo` をデプロイ

これでモックは現在の状態のまま凍結されます。

---

## Step 2. テスト用 Supabase プロジェクトを新規作成

1. https://supabase.com/dashboard → **New project**
2. 名前: `pomie-portal-test`（任意）／ リージョン: **Northeast Asia (Tokyo)**
3. データベースパスワードはパスワードマネージャーに保管
4. プロジェクト起動後、**SQL Editor** で以下を順に実行:

| 順 | ファイル | 内容 |
|---|---|---|
| 1 | `supabase/schema.sql` | 全テーブル作成 + GRANT |
| 2 | （任意）`supabase/seed.sql` | ダミー 12 名を入れる場合のみ |

> **クリーン開始する場合は seed.sql を実行しません。**
> テーブルだけ作り、実在の契約美容師を管理画面から登録していきます。

5. **Project Settings → API** から控える:
   - `Project URL`
   - `anon public` キー

> `schema.sql` は `if not exists` で書かれているため、migration-001〜005 を個別に流す必要はありません（最新スキーマが一括で作られます）。

---

## Step 3. Vercel でテスト用プロジェクトを作成

1. Vercel → **Add New → Project**
2. 同じ GitHub リポジトリ（`pomie-portal-mock`）を **Import**
3. **Project Name**: `pomie-portal-test`
4. **Settings → Git → Production Branch**: `main`（既定のまま）
5. **Environment Variables** に以下を登録:

| Name | Value | 必須 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | テスト用 Supabase の Project URL | ⭕ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | テスト用 anon public キー | ⭕ |
| `ADMIN_BASIC_USER` | 管理画面のログイン ID（任意の文字列） | ⭕ |
| `ADMIN_BASIC_PASSWORD` | 管理画面のパスワード（推測されにくいもの） | ⭕ |
| `SALONBOARD_DRIVER` | `mock` | ⭕ |
| `APIFY_API_TOKEN` | Instagram 実投稿を使うなら設定 | 任意 |

6. **Deploy**

---

## Step 4. 動作確認

デプロイ完了後、`https://pomie-portal-test.vercel.app` で確認:

- [ ] トップページが表示される（美容師 0 名なので一覧は空でも OK）
- [ ] `/admin` にアクセスすると **ID / パスワードを求められる**
- [ ] 正しい認証情報で管理画面に入れる
- [ ] `/admin/stylists/new` から美容師を 1 名登録できる
- [ ] 登録した美容師が `/stylists` に表示される
- [ ] 予約フォームから予約が通る
- [ ] Supabase の `reservations` テーブルに行が増える

---

## Step 5.（任意）mixhost のドメインを割り当てる

`pomie.example.com` のようなサブドメインで公開したい場合:

1. Vercel → pomie-portal-test → **Settings → Domains** → ドメインを追加
2. 表示された CNAME 値（例 `cname.vercel-dns.com`）を控える
3. mixhost cPanel → **Zone Editor** → 対象ドメインの管理 → **CNAME レコード追加**
   - 名前: `pomie`
   - CNAME: Vercel が指定した値
4. 5 分〜数時間で反映、SSL は Vercel が自動発行

---

## 運用フローの整理

```
機能追加・修正
   ↓
main ブランチに push
   ↓
pomie-portal-test に自動デプロイ   ← テスト運用環境（実データ）
   ↓
mock-demo ブランチは変わらない     ← モック環境（デモ用に凍結）
```

モックにも変更を反映したくなったら:
```bash
git checkout mock-demo
git merge main
git push
git checkout main
```

---

## テスト運用フェーズでの既知の制限

本番運用に進む前に対応が必要な項目です。

| 項目 | 現状 | 本番までに必要な対応 |
|---|---|---|
| 管理画面の認証 | Basic 認証（全員同じ ID/PW） | Supabase Auth + ロール管理 |
| 美容師のログイン | 認証なし（誰でも他人の画面に入れる） | Supabase Auth（本人のみ編集可） |
| DB のアクセス制御 | RLS 無効（anon キーで全件読み書き可） | RLS 有効化 + ポリシー設定 |
| サロンボード連携 | モック（Supabase 内で完結） | CSV / RPA / 公式 API のいずれか |
| LINE Bot | ポータル内モック UI | LINE Messaging API + Webhook |
| 予約の重複制御 | なし（同時予約は考慮外） | トランザクション / 楽観ロック |
| 顧客への通知 | なし | 予約確定メール / LINE 通知 |

> **とくに RLS 無効は重要**です。anon キーが漏れると外部から予約データを読み書きできます。
> テスト運用は「限られた関係者のみが触る」前提で進め、実顧客を入れる前に RLS を有効化してください。
