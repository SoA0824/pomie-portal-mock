---
name: propose-keywords
description: 記事にする検索キーワードの候補を、ラッコキーワードのコネクタで調査・選定し、管理画面で承認できるよう DB に登録する。「キーワード候補を出して」「記事のネタを集めて」「キーワード調査して」「候補を登録して」「次に書く記事を提案して」と言われたら使う。承認は人が管理画面（/admin/keywords）で行う。
---

# キーワード候補の提案

ラッコキーワードのコネクタ（MCP。ツール名の末尾が `suggest-keywords` / `question-search` など）で調査し、
評価して、記事の企画案つきで「提案中」の候補として DB に登録する。
**承認は行わない。** 管理者が `/admin/keywords` で承認した候補が記事になる。

基準は `docs/ARTICLE-GUIDELINES.md` の 2 章「キーワードの選び方」。最初に読む。

## 使い方

- `/propose-keywords` … 種キーワード（DB、無ければ自動生成）から候補を 8 件ほど提案する
- `/propose-keywords 恵比寿 白髪ぼかし` … この種から候補を探す
- 「10 件」「カラー系だけ」など、言われた条件に合わせる

クレジットの目安: 1 回の提案で **25 クレジット以内**（`suggest-keywords` は 1 回 5 クレジット）。`search-volume-history` は使わない。

## 手順

1. 材料を取る（美容師・既存記事・既存候補・語彙）:
   ```bash
   node scripts/articles/context.mjs --out /tmp/pomie-context.json
   ```
   - 失敗したら: `.env.production.local` が無い → 設定を依頼。テーブルが無い → `supabase/migration-009-keyword-pipeline.sql` の実行を依頼
   - `candidates`（既存の候補）と `articles` を見て、同じキーワードを提案しないようにする

2. 種キーワードを決める:
   ```bash
   node scripts/articles/candidates.mjs seeds --auto
   ```
   - 有効な種のうち、使っていない（最終使用が古い）ものから **最大 4 つ**。ユーザーが種を指定したらそれを使う

3. 種ごとにコネクタの `suggest-keywords` を呼ぶ（`keyword` に種、`limit` 40、`modes` は google）。
   **応答の JSON をそのままファイルに保存する**（例: `/tmp/pomie-rakko-1.json`。`data.items` が含まれていればよい）

4. 評価する:
   ```bash
   node scripts/articles/candidates.mjs score --file /tmp/pomie-rakko-1.json --seed "<種>"
   ```
   - `○` が候補、`✗` は除外（理由つき）。スコア・検索意図・対応できる美容師が出る
   - 種ごとに繰り返し、全体の上位 10〜15 件を見る

5. 企画する（ここは自分で考える）。上位から **8 件程度**を選び、各候補について:
   - `suggestedTitle`: 32 文字以内、キーワードを前半に、煽らない
   - `angle`: 読者が何を決められるようになるか + ポミエならではの情報（美容師・エリア・料金目安）の使い方
   - `category`: カット / カラー / メンズ / ケア / エリア
   - `targetStylistIds`: 対応できる掲載中の美容師（score の結果を参考に 1〜3 名）
   - `reason`: 選んだ理由（検索数・難易度・意図・美容師）
   - 除外: 他サロンの店名、テレビ番組、求人・口コミ、DIY（市販・セルフ）、既存記事と同じ狙い、同じ内容になる重複

6. 任意: 上位 2〜3 件は `question-search`（`keyword` にメニュー名など中心語、`limit` 20）で質問を取り、`faqQuestions` に上位 5〜8 個を入れる（1 回 5 クレジット。予算内で）

7. 候補ファイルを作って登録する（`/tmp/pomie-candidates.json`）:
   ```json
   [
     {
       "keyword": "表参道 髪質改善",
       "seed": "表参道 髪質改善",
       "searchVolume": 260, "seoDifficulty": 36, "competition": 25, "cpc": 0.92,
       "intent": "booking",
       "category": "ケア",
       "suggestedTitle": "表参道で髪質改善。くせ・広がりに合う選び方",
       "angle": "メニューの違いと料金目安を整理し、髪の状態別に向く選択を示して、対応できる美容師へつなぐ",
       "targetStylistIds": ["st-47e9gf"],
       "faqQuestions": ["髪質改善は何回くらい通えばいいですか?"],
       "reason": "検索数 260・難易度 36 で立ち上げ期に合う。予約に近い意図。表参道の美容師が対応できる"
     }
   ]
   ```
   ```bash
   node scripts/articles/candidates.mjs add --file /tmp/pomie-candidates.json
   ```

8. 報告する: 候補の表（キーワード / 検索数 / 難易度 / 意図 / 美容師 / タイトル案）、除外した主なもの、使ったクレジット、
   そして「`/admin/keywords` で承認してください。承認した候補は `/write-article --approved` で記事にできます」と案内する。

## してはいけないこと

- 候補を承認状態で登録する（常に提案中）
- 掲載中の美容師が対応できないキーワードを、その旨を書かずに提案する
- クレジットを 25 以上使う、`search-volume-history` を呼ぶ
- ラッコの応答の数値（検索数・難易度）を書き換える
