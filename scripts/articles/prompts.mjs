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
