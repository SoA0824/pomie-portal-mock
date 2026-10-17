---
name: make-social-post
description: POMiE ポータルの記事をもとに、Instagram / X 向けの投稿文とスライド画像を作る。管理画面の「SNS 投稿を作る」で出された依頼（または「画像の作り直し」の依頼）を処理し、投稿文・ハッシュタグ・スライドの文言・AI 画像（Gemini）を「下書き」として保存する。投稿は人が管理画面で確認して手動で行う。「SNS 投稿を作って」「インスタ用に」「X 用に」「画像を作り直して」と言われたら使う。
---

# SNS 投稿を作る

記事と同じテーマで、Instagram（カルーセル）・Threads・X の投稿を作る。**SNS に投稿はしない**。下書きを保存し、
管理者が `/admin/social` でプレビュー・修正 → 「書き出す」→ Instagram / Threads は管理画面のボタンで投稿、X は手動で投稿する。

記事の表現のルールは `docs/ARTICLE-GUIDELINES.md` 5 章（NG 表現）に従う。

## 使い方

- `/make-social-post` … 管理画面で出された依頼を順に処理する
- `/make-social-post omotesando-head-spa` … チャットから依頼して、そのまま処理する（`--brief` で指示を添えられる）
- 「画像を作り直して」の依頼も同じ手順（context の `post.mode` が regenerate になる）

## 手順

1. 依頼を確認する
   ```bash
   node scripts/social/social.mjs list
   ```
   チャットで頼まれたときは先に登録する:
   ```bash
   node scripts/social/social.mjs request --article <slug> [--platforms instagram,x] [--brief "<指示>"]
   ```
   - テーブルが無いエラー → `supabase/migration-013-social-posts.sql` の実行を依頼する

2. 材料を取る（依頼ごと）
   ```bash
   node scripts/social/social.mjs context <投稿ID>
   ```
   - 材料の JSON（記事の本文・店舗写真・必須ハッシュタグ・ルール・投稿に書かない美容師の名前）と、企画ファイル `content/social/<投稿ID>.json` ができる
   - 作り直し（regenerate）のときは、企画ファイルに今の内容が入っている。**必要な箇所だけ**直す

3. 企画ファイルを書く（ここは自分で考える）

   ```json
   {
     "caption": "Instagram の本文（ハッシュタグは含めない）",
     "hashtags": ["pomie", "ポミエ", "pomie表参道", "ポミエ表参道", "シェアサロン", "フリーランス美容師", "美容師独立", "表参道美容室", "ヘッドスパ", "..."],
     "alt_text": "画像の説明 1〜2 文",
     "x_text": "X の本文（URL なし。最後に『詳しくは返信のリンクから』）",
     "x_reply": "返信の一言（URL は自動で付く）",
     "threads_text": "Threads の本文（要点 2〜3 つ＋最後に記事 URL。URL が無ければ自動で付く）",
     "template": "photo",
     "slides": [
       { "kind": "cover", "headline": "記事タイトルを短く", "body": "ひとこと", "image": { "source": "ai", "prompt": "..." } },
       { "kind": "point", "headline": "ポイント 1", "body": "説明", "image": { "source": "none" } },
       { "kind": "point", "headline": "ポイント 2", "body": "説明", "image": { "source": "none" } },
       { "kind": "point", "headline": "ポイント 3", "body": "説明", "image": { "source": "none" } },
       { "kind": "cta", "headline": "続きはプロフィールのリンクから", "body": "記事で詳しくまとめています", "image": { "source": "none" } }
     ]
   }
   ```

   - **トーン**: 読みやすく、固すぎない。です・ます調をベースに話しかけるように。読者（お客さま）に向けて書く
   - **美容師の情報は入れない**: 投稿はポータルの記事の紹介。美容師の名前・プロフィール・写真・リンクは本文にもスライドにも書かない（美容師は記事の中で紹介される。名前が入ると検品でエラー）。店舗名も基本は書かない（エリア名は可）
   - **Instagram 本文**: 200〜800 文字。冒頭 1 行で内容が分かるように。箇条書き可。URL は書かず「詳しくはプロフィールのリンクから」。絵文字は 2〜4 個まで
   - **ハッシュタグ**: 必須タグ（context に出る）＋記事に合うテーマのタグで合計 10〜15 個
   - **X**: 本文は日本語 140 文字以内・URL なし。記事リンクは返信（x_reply）に載せる
   - **Threads**: 300 文字以内が目安（上限 500）。本文のリンクが押せるので、最後に記事 URL を置く。X より少し詳しく
   - **スライド**: 4〜5 枚（cover → point × 2〜3 → cta）。見出し 28 文字以内、本文 70 文字以内。記事の見出し・主張から作り、新しい主張や数字を足さない。**絵文字は使わない**（画像にしたときに消える）。見出しが 13 文字を超えるときは、区切りのよい位置に `\n` を入れて折り返しを指定する（例: `"表参道でヘッドスパ、\n美容室で受ける理由"`）
   - **画像**: AI 画像は表紙など 1〜2 枚まで（1 枚 ¥6〜20）。指示は英語でよい。雰囲気（サロンの空間、髪の質感の寄り、小物、光）だけを描く。**人の顔・施術例・ビフォーアフター風・文字は描かない**（文字はテンプレートが載せる）。他のスライドは `none`（クリーム地）か店舗写真（context の `stores[].photos[].path`）
   - **事実**: 料金・メニューなどは記事にあるものだけ。発言・お客様の声・施術例を創作しない

4. 検品して保存する（AI 画像もここで作られる）
   ```bash
   node scripts/social/social.mjs save <投稿ID> --file content/social/<投稿ID>.json
   ```
   - エラーがあれば直してもう一度。作り直しで画像も作り直すときは `--regenerate`
   - 画像だけ作り直す: `node scripts/social/social.mjs images <投稿ID> --slide 1 --force`
   - 画像 API のキーが無いエラー → `.env.production.local` に `GEMINI_API_KEY` を追加してもらう（文字の下書きは保存されている）
   - どうしても作れない場合: `node scripts/social/social.mjs fail <投稿ID> --reason "<理由>"`

5. 報告する
   - 表紙の見出し、スライドの構成、Instagram 本文の冒頭、X の本文、使った AI 画像の枚数、`[要確認]` があればその一覧
   - 「`/admin/social/<投稿ID>` でプレビューを確認し、必要なら直して『書き出す』→ Instagram / Threads は『投稿する』ボタン、X は画像と本文をコピーして投稿してください」と案内する

## してはいけないこと

- SNS に投稿する・投稿の予約をする（投稿は人が行う）
- 記事（`articles`）を書き換える
- 人の顔・施術例・ビフォーアフター風の AI 画像を作る。画像の中に文字を描かせる
- 美容師の名前・写真・リンクを投稿に入れる（記事の中で紹介される）
- AI 画像を 1 投稿 3 枚より多く作る
