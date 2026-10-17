# SNS 投稿の作成（記事 → Instagram / X）

記事と同じテーマで、Instagram と X に載せる**投稿文と画像**を作る機能。
記事パイプラインと同じ考え方で、**作るのは自動、出すのは人**（投稿前に必ず確認し、投稿は手動）。

## 全体の流れ

```
① 依頼    /admin/articles の公開中の記事 →「SNS 投稿を作る」（媒体・ひとこと指示）
② 作成    Claude Code で /make-social-post
          記事 → 投稿文・ハッシュタグ・スライドの文言・画像の指示を作る
          → Gemini で雰囲気画像を生成 → Storage に保存 → 「下書き」
③ 確認    /admin/social でプレビュー。文言を直す・画像を差し替える（店舗写真 / アップロード / 作り直し依頼）
④ 書き出し 「書き出す」→ 文字を合成した最終画像（1080×1350 JPEG）ができる
⑤ 投稿    Instagram / Threads は管理画面の「投稿する」ボタン（API）。X は画像をダウンロード・本文をコピーして手動
```

## 初回の準備

1. Supabase の SQL Editor で `supabase/migration-013-social-posts.sql` を実行する（テーブルと画像の保存先を作る）
2. https://aistudio.google.com で Gemini の API キーを発行し、プロジェクト直下の `.env.production.local` に 1 行足す:
   ```
   GEMINI_API_KEY=（発行したキー）
   ```
   - Vercel には不要（画像生成はサーバーでは行わない）
   - OpenAI を使う場合は `OPENAI_API_KEY`（組織の本人確認が必要）。両方あるときは `SOCIAL_IMAGE_PROVIDER=openai` で切り替え
3. Instagram のプロフィールのリンクをポータルのトップ（https://portal.pomie.jp/）にしておく。トップの一番上には新着記事（固定した記事 → 新しい順）が並ぶ
4. 自動投稿を使うなら `supabase/migration-014-social-publish.sql` を実行し、Vercel の Environment Variables に次を追加して再デプロイ:
   - `INTEGRATION_SECRET` … 32 文字以上のランダムな文字列（トークンの暗号化に使う）
   - `CRON_SECRET` … ランダムな文字列（毎日のトークン自動更新用。vercel.json の cron が使う）
5. `/admin/social/settings` で Instagram / Threads のトークンを登録する（取り方は画面に書いてある。Meta for Developers のアプリは「開発モード」のままでよい）

## 決めごと

| 項目 | 内容 |
|---|---|
| 媒体 | Instagram（ビジネスアカウント）＋ Threads ＋ X。文章は媒体ごと、画像は共通。Instagram / Threads は API で投稿、X は手動 |
| 形式 | Instagram はカルーセル 4〜5 枚（表紙 → ポイント × 2〜3 → まとめ・導線）。X は 1 枚目の画像を添付 |
| リンク | Instagram: 本文に URL は書かず「プロフィールのリンクから」（リンク先はポータルのトップ。一番上に新着記事）。Threads: 本文に記事 URL（押せる）。X: 本文には入れず、**返信に記事 URL**（UTM 付き） |
| トーン | 読みやすく、固すぎない。です・ます調をベースに話しかけるように |
| ハッシュタグ | いつも付ける: `#pomie #ポミエ` ＋ エリア付き（`#pomie表参道 #ポミエ表参道` など）＋ `#シェアサロン #フリーランス美容師 #美容師独立`。これに記事に合うテーマのタグを足して合計 10〜15 個 |
| 画像 | AI は「雰囲気」用に 1〜2 枚（サロンの空間・髪の質感・小物・光）。実在の店舗でなくてよい。**人の顔・施術例・ビフォーアフター風・文字は描かない**。他は店舗写真かクリーム地 |
| 美容師の情報 | 投稿には入れない（名前・写真・リンク）。投稿はポータルの記事紹介で、美容師は記事の中で紹介される。名前が入っていると検品でエラー。店舗名も基本は書かない（エリア名は可） |
| 文字の検品 | 記事と同じ NG 表現（薬機法・景表法）、文字数、ハッシュタグ数、絵文字（スライドの文字には使えない） |

## 画像のしくみ（AI 画像と文字を分ける）

AI 画像モデルは日本語の文字を正確に描けないため、画像を 2 層にしている。

- **背景**: AI 生成（Gemini）/ 店舗写真 / アップロード
- **文字**（見出し・ロゴ・ページ番号）: サイト側がテンプレートで合成（`src/lib/social/templates.tsx`）。フォントは Noto Sans JP、色はサイトと同じ。ロゴアイコンは `src/lib/social/brandIcon.ts`（`public/logo/pomie-icon.svg` と同じ）

文字を直したら「保存」→「書き出す」だけで作り直せる（AI を呼び直さないので無料・数秒）。
テンプレートは「写真＋文字」と「クリーム地（ロゴアイコンの透かし入り）」の 2 種。画像の無いスライドは自動でクリーム地になり、
画像の無い「まとめ・導線」スライドはアイコンを中央に置いたレイアウトになる。見出しに改行を入れると、その位置で折り返す。
店舗名・エリアはスライドに出さない（美容師のポータルとしての発信であって、店舗の発信ではないため）。

AI 画像には見えない透かし（Gemini: SynthID）が入り、Instagram が「AI 情報」ラベルを付けることがある。店舗写真だけの投稿には付かない。

## ブランド設定（他社展開用）

スライドの見た目と必須ハッシュタグは、次の 2 つだけで決まる（テンプレートにブランド固有の値は書かない）。

- `data/brand.json` … 名前、色（地・アクセント・文字・写真の上の文字）、フォント（Google Fonts の family）、ブランドタグ・固定タグ、透かしの濃さ。サイト側（`src/lib/social/brand.ts`）とスクリプト（`scripts/social/lib.mjs`）が同じファイルを読む
- `src/lib/social/brandAssets.ts` … ワードマークとアイコンの SVG（色は `__COLOR__` を置き換える）。`public/logo/*.svg` から生成

他社向けに使うときは、この 2 つを差し替える（ハッシュタグのエリア付きの形 `#ブランド名エリア名` も自動で変わる）。

## 費用の目安

- 画像: Gemini Flash で約 ¥6/枚、Pro で約 ¥20/枚。1 投稿あたり **¥10〜40**（店舗写真だけなら ¥0）
- 文章: Claude Code の経路なら追加費用なし

## 管理画面

- `/admin/articles` … 公開中の記事に「SNS 投稿を作る」。記事ごとの件数（作成待ち / 下書き / 投稿できます / 投稿済み）
- `/admin/social` … 一覧（進行中 / 作成待ち / 投稿できます / 投稿済み / すべて）
- `/admin/social/<id>` … 詳細
  - スライド: プレビュー（保存した内容で描画）、見出し・本文・種類・見た目、背景画像（なし / AI / 店舗写真 / アップロード）、並べ替え・追加・削除
  - 投稿文: Instagram の本文・ハッシュタグ・alt、X の本文・返信（文字数の目安つき）、コピー
  - 書き出し: 最終画像（JPEG）を作る → 1 枚ずつ開く / すべてダウンロード
  - 投稿: Instagram / Threads は「投稿する」ボタンで API 投稿（投稿 URL が記録される）。X は手動で投稿して「手動で投稿済みにする」。全部投稿すると状態が「投稿済み」
- `/admin/social/settings` … Instagram / Threads の連携（トークンの登録・更新・解除、有効期限の表示）
- `/admin/articles` の「トップに固定」… その記事をトップの一番上に固定（新着より前）。PICK UP の印が付く
  - 画像の作り直しを依頼: 指示を書いて依頼 → `/make-social-post` が作り直す

## スクリプト（`scripts/social/`）

| コマンド | 内容 |
|---|---|
| `social.mjs list` | 作成待ちの一覧 |
| `social.mjs request --article <slug> [--platforms instagram,x] [--brief "..."]` | チャットから依頼 |
| `social.mjs context <id>` | 材料の JSON と企画ファイル `content/social/<id>.json` を用意 |
| `social.mjs save <id> --file content/social/<id>.json [--regenerate] [--no-images]` | 検品 → 下書きとして保存 → AI 画像を生成 |
| `social.mjs images <id> [--slide 1] [--force] [--ref store]` | AI 画像だけ作る（`--ref store` で店舗写真を雰囲気の参考に渡す） |
| `social.mjs fail <id> --reason "..."` | 失敗として記録 |

`providers.mjs` が画像 API の差し替え口（gemini / openai）。モデル名は `GEMINI_IMAGE_MODEL` / `OPENAI_IMAGE_MODEL` で上書きできる。

## データ

- テーブル `social_posts`（`sns_posts` は美容師の Instagram 取得用なので別）
- Storage バケット `social-images`（公開）: `social/<id>/raw-*.png` が AI の元画像、`social/<id>/slide-*.png` が書き出した最終画像。投稿を削除すると画像も消える

## 自動投稿のしくみ

- Instagram は「Instagram API with Instagram Login」、Threads は「Threads API」。どちらも Meta for Developers のアプリで、自分のアカウントをテスターに追加すれば開発モードのまま使える（審査不要）
- トークン（60 日有効）は `integration_tokens` に暗号化して保存。投稿時と毎日の cron（`/api/cron/refresh-social-tokens`）で、前回更新から 7 日たっていれば更新する
- 投稿の流れ: 画像ごとにコンテナ作成 → カルーセルにまとめる → 処理完了を待つ → 公開 → 投稿 URL を記録
- できないこと: ストーリーズのリンクスタンプ、ハイライトへの保存、Instagram 本文のリンク（API の制限）
- 接続先はテスト用に `INSTAGRAM_GRAPH_BASE` / `THREADS_GRAPH_BASE` で差し替えられる

## 今後（未実装）

- 予約投稿（日時を指定して自動で投稿）
- GitHub Actions で、記事の公開を検知して下書きを自動作成（サーバー経路）

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| 「投稿を読み込めませんでした」 | migration-013 未実行 |
| 「画像 API のキーがありません」 | `.env.production.local` に `GEMINI_API_KEY` を追加 |
| 「画像の保存に失敗しました」 | migration-013 の Storage バケット部分が未実行 |
| Gemini が HTTP 429 | 上限。しばらく待つか Google Cloud の課金設定を確認 |
| 連携設定で「INTEGRATION_SECRET が未設定」 | Vercel の Environment Variables に追加して再デプロイ |
| 投稿で「トークンが無効か期限切れ」 | 連携設定でトークンを入れ直す |
| 投稿で「画像が古い形式（PNG）」 | もう一度「書き出す」（JPEG になる） |
| 書き出しで「描画に失敗しました」 | フォントの取得（Google Fonts）に失敗した可能性。もう一度試す |
| スライドの文字が一部消える | 絵文字は表示できない。文字から外す |
