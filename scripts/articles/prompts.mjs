/**
 * 自動執筆・企画案づくりのプロンプト。
 * 記事のルールは docs/ARTICLE-GUIDELINES.md が正本で、ここではそれをそのまま渡す。
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, CATEGORIES } from "./lib.mjs";

export function loadGuidelines() {
  return fs.readFileSync(path.join(ROOT, "docs", "ARTICLE-GUIDELINES.md"), "utf8");
}

const DRAFT_FORMAT = `出力は次の形式のファイル本文だけにする。前置き・説明・コードフェンスは付けない。

---
title: （32 文字以内。キーワードを前半に）
slug: （半角英小文字・数字・ハイフン。内容が分かる英語。例: omotesando-kamishitsu-kaizen）
category: （${CATEGORIES.join(" / ")} のいずれか）
summary: （80〜120 文字。誰向けで何が分かるか）
target_keyword: （指定されたキーワードをそのまま）
related_stylist_ids: [（紹介する美容師の ID をカンマ区切り。例: st-47e9gf）]
cover_image: （店舗写真のパス、または空）
---

（書き出し 2〜4 文。キーワードを含める）

## 見出し
…`;

function stylistSummary(s) {
  return [
    `- id: ${s.id} / 名前: ${s.name} / 所属: ${s.store?.name ?? ""}（${s.store?.area ?? ""}）`,
    `  強み: ${s.strengths.join("、") || "（未入力）"}`,
    `  得意メニュー: ${s.specialtyMenus.join("、") || "（未入力）"}`,
    `  予約可能メニュー: ${s.menus.map((m) => `${m.name}（${m.duration}分）`).join("、") || "（未入力）"}`,
    `  料金目安: ${s.priceRange.min > 0 || s.priceRange.max > 0 ? `¥${s.priceRange.min.toLocaleString()}〜¥${s.priceRange.max.toLocaleString()}` : "指定なし"}`,
    `  プロフィール: ${String(s.profile).replace(/\s+/g, " ").slice(0, 200)}`,
    `  ページ: /stylists/${s.id}`,
  ].join("\n");
}

/** 執筆用 system プロンプト（固定。キャッシュされる） */
export function writerSystem(guidelines) {
  return `あなたは美容室のポータルサイト「POMiE Portal」の編集者です。検索で見つけてもらい、読んだ人の悩みを解決し、ポミエ契約美容師のページへ自然に送客する記事を書きます。

以下の「記事ガイドライン」を必ず守ります。特に次の点は絶対です。
- 美容師について書いてよいのは、ユーザーメッセージで渡された公開情報だけ。発言・施術例・お客様の声・経歴を創作しない
- 使ってはいけない表現（治る・修復・永久・絶対・No.1 など）を使わない
- 表（| 区切り）と画像は使わない。見出しは ## から
- 事実として断定できないことは [要確認: 内容] と書く
- 送客セクションと「よくある質問」を必ず入れる

====== 記事ガイドライン ======
${guidelines}
====== ガイドラインここまで ======

${DRAFT_FORMAT}`;
}

/** 執筆用 user プロンプト（候補・材料・調査結果） */
export function writerUser({ candidate, context, research }) {
  const target = context.stylists.filter((s) => candidate.targetStylistIds?.includes(s.id));
  const others = context.stylists.filter((s) => !candidate.targetStylistIds?.includes(s.id));
  const published = context.articles.filter((a) => a.status === "published");

  const lines = [];
  lines.push(`# 書く記事`);
  lines.push(`- 狙うキーワード: ${candidate.keyword}`);
  if (candidate.searchVolume !== null && candidate.searchVolume !== undefined) lines.push(`- 月間検索数: ${candidate.searchVolume} / SEO 難易度: ${candidate.seoDifficulty ?? "不明"}`);
  if (candidate.intent) lines.push(`- 検索意図: ${candidate.intent === "booking" ? "予約に近い（美容師・サロンを探している）" : candidate.intent === "compare" ? "比較・検討" : "情報収集"}`);
  if (candidate.suggestedTitle) lines.push(`- タイトル案（変えてよい）: ${candidate.suggestedTitle}`);
  if (candidate.angle) lines.push(`- 切り口: ${candidate.angle}`);
  if (candidate.category) lines.push(`- カテゴリ案: ${candidate.category}`);
  if (candidate.note) lines.push(`- 運営からの指示（最優先）: ${candidate.note}`);

  lines.push(``, `# 調査結果`);
  if (research?.questions?.length) {
    lines.push(`## 実際に検索されている質問（「よくある質問」の材料。上から需要が高い順）`);
    for (const q of research.questions.slice(0, 15)) lines.push(`- ${q.question ?? q}`);
  }
  if (research?.suggestions?.length) {
    lines.push(`## 関連する検索キーワード（見出しや本文で自然に触れる。全部使う必要はない）`);
    for (const s of research.suggestions.slice(0, 20)) {
      lines.push(`- ${s.keyword}${s.searchVolume !== null && s.searchVolume !== undefined ? `（${s.searchVolume}/月）` : ""}`);
    }
  }
  if (candidate.faqQuestions?.length && !research?.questions?.length) {
    lines.push(`## よくある質問の材料`);
    for (const q of candidate.faqQuestions) lines.push(`- ${q}`);
  }

  lines.push(``, `# 使ってよい一次情報（これ以外の美容師情報は書かない）`);
  lines.push(`## 紹介する美容師（送客セクションと related_stylist_ids に使う）`);
  if (target.length) for (const s of target) lines.push(stylistSummary(s));
  else lines.push(`（指定なし。下の掲載中の美容師から、キーワードに合う人を 1〜3 名選ぶ。合う人がいなければ店舗の一覧ページへ誘導する）`);
  if (others.length) {
    lines.push(`## その他の掲載中の美容師`);
    for (const s of others) lines.push(stylistSummary(s));
  }
  lines.push(`## 店舗`);
  for (const st of context.stores) lines.push(`- ${st.id}: ${st.name}（${st.area}）${st.catchphrase ? ` — ${st.catchphrase}` : ""} / 写真: ${st.image}`);

  lines.push(``, `# サイト内リンク`);
  lines.push(`- 美容師ページ: /stylists/{id}`);
  lines.push(`- 店舗で絞った一覧: /stylists?storeId=s1（表参道）/ /stylists?storeId=s2（恵比寿）`);
  lines.push(`- メニューで絞った一覧: /stylists?menu={メニュー名を URL エンコード}`);
  lines.push(`- 診断: /match`);
  if (published.length) {
    lines.push(`- 公開中の記事（関連があれば本文からリンクしてよい）:`);
    for (const a of published.slice(0, 20)) lines.push(`  - /articles/${a.slug} 「${a.title}」`);
  }

  lines.push(``, `# 依頼`);
  lines.push(`上の材料で、ガイドラインに沿った記事を 1 本、指定の形式で書いてください。本文は 2,500〜4,500 文字。`);
  return lines.join("\n");
}

/** 検品で直す箇所を伝えて書き直してもらう */
export function fixUser(lint) {
  const lines = [`検品で次の問題が見つかりました。該当箇所を直し、同じ形式でファイル全文をもう一度出力してください（直す必要のない部分は変えない）。`, ``];
  for (const e of lint.errors) lines.push(`- [必ず直す] ${e.message}`);
  for (const w of lint.warnings) lines.push(`- [できれば直す] ${w.message}`);
  return lines.join("\n");
}

/** 企画案づくり（候補のタイトル・切り口・紹介する美容師を決める） */
export function plannerSystem() {
  return `あなたは美容室ポータル「POMiE Portal」の SEO 編集者です。キーワード候補ごとに、記事の企画案を JSON で作ります。

判断基準:
- 掲載中の美容師が実際に対応できるキーワードを優先する（得意メニュー・予約可能メニュー・エリア）
- 予約に近い検索意図を優先する
- 他サロンの店名・テレビ番組名・求人・口コミ・DIY（市販・セルフ）のキーワードは keep: false
- 同じ内容になる候補が複数あれば、1 つだけ keep: true にして他は false
- タイトルは 32 文字以内、キーワードを前半に、煽らない
- 切り口は「読者が何を決められるようになるか」と「ポミエならではの情報（美容師・エリア・料金目安）をどう使うか」を 1〜2 文で

出力は JSON 配列だけ。各要素: {"keyword": "...", "keep": true|false, "title": "...", "angle": "...", "category": "カット|カラー|メンズ|ケア|エリア", "intent": "booking|compare|info", "target_stylist_ids": ["..."], "reason": "..."}`;
}

export function plannerUser({ items, context }) {
  const lines = [`# 掲載中の美容師`];
  for (const s of context.stylists) lines.push(stylistSummary(s));
  lines.push(``, `# 店舗`);
  for (const st of context.stores) lines.push(`- ${st.name}（${st.area}）`);
  const published = context.articles.filter((a) => a.status === "published");
  if (published.length) {
    lines.push(``, `# 既にある記事（重複を避ける）`);
    for (const a of published) lines.push(`- ${a.title}（${a.targetKeyword ?? "キーワード未設定"}）`);
  }
  lines.push(``, `# キーワード候補（月間検索数 / SEO 難易度 / 推定意図 / 対応できそうな美容師 ID）`);
  for (const it of items) {
    lines.push(`- ${it.keyword} / ${it.searchVolume ?? "不明"} / ${it.seoDifficulty ?? "不明"} / ${it.intent} / ${it.targetStylistIds.join(",") || "なし"}`);
  }
  lines.push(``, `上の候補すべてについて企画案を JSON 配列で返してください。`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// リライト（API 実行用。Claude Code では .claude/skills/rewrite-article が同じルールを持つ）
// ---------------------------------------------------------------------------

const REWRITE_FORMAT = `出力は次の 3 つの区切りを必ずこの順で含める。前置き・説明・コードフェンスは付けない。

===ANALYSIS===
（分析の要約 3〜6 行。何が問題で、なぜその直し方にしたか）
===SUMMARY===
（変更点の箇条書き。どこをどう変えたか）
===DRAFT===
---
title: （変えないならそのまま。変えるなら 32 文字以内・キーワードを前半に）
category: （元と同じ。または ${CATEGORIES.join(" / ")}）
summary: （80〜120 文字）
target_keyword: （元のまま）
related_stylist_ids: [（差し替え後の美容師 ID をカンマ区切り）]
areas: [（元のまま）]
base_updated_at: （渡された値をそのまま）
---

（本文全文。Markdown。見出しは ## から。省略や「以下同じ」は不可）`;

export function rewriterSystem(guidelines) {
  return `あなたは美容室のポータルサイト「POMiE Portal」の編集者です。公開中の記事を、依頼の指示に沿ってリライトします。

守ること:
- 原型を保つ: 見出しの構成・主張・良い部分は残す。指示がない限り、全面的な書き直しや構成の大きな変更はしない
- URL（slug）は変えない。base_updated_at は渡された値をそのまま書く
- 美容師の差し替え: 外す美容師の名前・リンク・メニューの記述を本文全体から消し、加える美容師はユーザーメッセージにある公開情報だけで紹介する
- 料金・施術時間・メニューは、渡された今の値に合わせる
- 美容師の発言・施術例・お客様の声を創作しない。断定できないことは [要確認: 内容]
- 使ってはいけない表現（治る・修復・永久・絶対・No.1 など）を使わない。表と画像は使わない

====== 記事ガイドライン ======
${guidelines}
====== ガイドラインここまで ======

${REWRITE_FORMAT}`;
}

export function rewriterUser({ context, draft }) {
  const rev = context.revision;
  const lines = [`# リライトの依頼`, `- 指示: ${rev.instruction || "（指示なし。下の分析の「気になる点」を直す）"}`];
  if (rev.stylistSwap?.remove?.length) lines.push(`- 外す美容師: ${rev.stylistSwap.remove.join(", ")}`);
  if (rev.stylistSwap?.add?.length) lines.push(`- 加える美容師: ${rev.stylistSwap.add.join(", ")}`);
  lines.push(``, `# 記事の状況（分析）`, JSON.stringify(context.analysis, null, 2));
  lines.push(``, `# 美容師の情報（これ以外の美容師情報は書かない）`, JSON.stringify(context.stylists, null, 2));
  lines.push(``, `# 店舗`, JSON.stringify(context.stores.map((s) => ({ id: s.id, name: s.name, area: s.area })), null, 2));
  if (context.publishedArticles?.length) {
    lines.push(``, `# 公開中の他の記事（関連があればリンクしてよい）`);
    for (const a of context.publishedArticles.slice(0, 20)) lines.push(`- /articles/${a.slug} 「${a.title}」`);
  }
  lines.push(``, `# 今の記事（この内容を直す。フロントマターの base_updated_at はそのまま）`, draft);
  lines.push(``, `# 依頼`, `上の指示と分析をもとに、原型を保ってリライトし、指定の 3 区切りの形式で出力してください。`);
  return lines.join("\n");
}

export function rewriteFixUser(lint) {
  const lines = [`検品で次の問題が見つかりました。該当箇所を直し、同じ 3 区切りの形式で全体をもう一度出力してください（直す必要のない部分は変えない）。`, ``];
  for (const e of lint.errors) lines.push(`- [必ず直す] ${e.message}`);
  for (const w of lint.warnings) lines.push(`- [できれば直す] ${w.message}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// SNS 投稿（API 実行用。Claude Code では .claude/skills/make-social-post が同じルールを持つ）
// ---------------------------------------------------------------------------

export function socialSystem(guidelines) {
  return `あなたは美容室ポータル「POMiE Portal」の SNS 担当です。記事をもとに Instagram（カルーセル）・Threads・X の投稿を企画し、JSON で出力します。

ユーザーメッセージの rules / hashtags / links を必ず守ります。特に:
- 美容師の名前・写真・リンクは入れない（article.stylistNamesNotToUse の名前は一切書かない）
- hashtags.required をすべて含め、記事に合うタグを足して合計 10〜15 個
- Instagram の本文（caption）に URL と # は書かない。X の本文（x_text）に URL を入れない。Threads（threads_text）は最後に記事 URL
- スライドの文字に絵文字を使わない。見出しは 28 文字以内（13 文字を超えるなら区切りのよい位置に改行を入れる）、本文は 70 文字以内
- AI 画像は 1〜2 枚。人の顔・施術例・ビフォーアフター風・文字を描かせない。指示（prompt）は英語でよい
- 記事に無い事実・数字を足さない。下のガイドラインの「使ってはいけない表現」を使わない

====== 記事ガイドライン（表現のルール） ======
${guidelines}
====== ここまで ======

出力は JSON オブジェクトだけ（前置き・説明・コードフェンスは不要）:
{
  "caption": "Instagram の本文",
  "hashtags": ["pomie", "ポミエ", "..."],
  "alt_text": "画像の説明 1〜2 文",
  "x_text": "X の本文（最後に『詳しくは返信のリンクから』）",
  "x_reply": "返信の一言（URL は自動で付く）",
  "threads_text": "Threads の本文（要点 2〜3 つ＋最後に記事 URL）",
  "template": "photo",
  "slides": [
    { "kind": "cover", "headline": "…", "body": "…", "image": { "source": "ai", "prompt": "…" } },
    { "kind": "point", "headline": "…", "body": "…", "image": { "source": "none" } },
    { "kind": "point", "headline": "…", "body": "…", "image": { "source": "none" } },
    { "kind": "cta", "headline": "続きはプロフィールのリンクから", "body": "…", "image": { "source": "none" } }
  ]
}
post.platforms に無い媒体の項目は省略してよい。`;
}

export function socialUser({ context }) {
  const regenerate = String(context.post?.mode ?? "").startsWith("regenerate");
  const lines = [`# 材料`, JSON.stringify(context, null, 2), ``, `# 依頼`, `上の材料で投稿の企画を JSON で作ってください。`];
  if (regenerate) lines.push(`post.existingPlan を土台に、必要な箇所だけ直してください。画像の作り直しの指示: ${context.post.imageRequest ?? "なし"}`);
  if (context.post?.brief) lines.push(`運営からの指示（最優先）: ${context.post.brief}`);
  return lines.join("\n");
}

export function socialFixUser(lint) {
  const lines = [`検品で次の問題が見つかりました。該当箇所を直し、JSON 全体をもう一度出力してください（直す必要のない部分は変えない）。`, ``];
  for (const e of lint.errors) lines.push(`- [必ず直す] ${e}`);
  for (const w of lint.warnings) lines.push(`- [できれば直す] ${w}`);
  return lines.join("\n");
}
