"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  decideKeywordCandidates,
  deleteKeywordCandidate,
  retryKeywordCandidate,
} from "@/server/actions/keywords";
import type { KeywordCandidate, KeywordCandidateStatus } from "@/lib/types";
import type { StylistOption } from "@/components/admin/ArticleForm";
import { RunJobButton } from "@/components/admin/RunJobButton";

/** 記事化済みの候補に付ける、記事側の状態 */
export type CandidateArticleInfo = { status: "draft" | "published"; title: string; slug: string };

const TABS: Array<{ key: KeywordCandidateStatus | "all"; label: string }> = [
  { key: "proposed", label: "提案中" },
  { key: "approved", label: "承認済み" },
  { key: "written", label: "記事化済み（下書き）" },
  { key: "failed", label: "失敗" },
  { key: "rejected", label: "却下" },
  { key: "all", label: "すべて" },
];

const INTENT_LABEL: Record<string, { label: string; className: string }> = {
  booking: { label: "予約に近い", className: "bg-green-100 text-green-800" },
  compare: { label: "比較・検討", className: "bg-amber-100 text-amber-800" },
  info: { label: "情報収集", className: "bg-ink-100 text-ink-700" },
};

const STATUS_LABEL: Record<KeywordCandidateStatus, string> = {
  proposed: "提案中",
  approved: "承認済み（記事化待ち）",
  rejected: "却下",
  writing: "記事化中…",
  written: "記事化済み",
  failed: "失敗",
};

function difficultyLabel(d: number | null) {
  if (d === null) return "不明";
  if (d <= 33) return `${d}（低）`;
  if (d <= 66) return `${d}（中）`;
  return `${d}（高）`;
}

export function KeywordCandidateList({
  candidates,
  stylists,
  articles = {},
}: {
  candidates: KeywordCandidate[];
  stylists: StylistOption[];
  /** 記事 ID → 記事の状態（記事化済みの候補の表示に使う） */
  articles?: Record<string, CandidateArticleInfo>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<KeywordCandidateStatus | "all">("proposed");
  const [showPublished, setShowPublished] = useState(false);
  // 公開まで済んだ候補は役目を終えているので、既定では一覧に出さない
  const isPublished = (c: KeywordCandidate) => c.status === "written" && Boolean(c.articleId && articles[c.articleId]?.status === "published");
  const publishedCount = candidates.filter(isPublished).length;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const stylistName = useMemo(() => new Map(stylists.map((s) => [s.id, s.name])), [stylists]);

  const inTab = (c: KeywordCandidate) => (tab === "all" ? true : tab === "approved" ? c.status === "approved" || c.status === "writing" : c.status === tab);
  const visible = candidates
    .filter((c) => inTab(c) && (showPublished || !isPublished(c)))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>, done: string) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setFeedback(done);
        setSelected(new Set());
        router.refresh();
      } else {
        setFeedback(`失敗しました: ${result.reason}`);
      }
    });
  };

  const decide = (ids: string[], decision: "approved" | "rejected") =>
    run(
      () => decideKeywordCandidates(ids, decision, ids.length === 1 ? notes[ids[0]] : undefined),
      decision === "approved" ? `${ids.length} 件を承認しました（次回の自動実行で記事になります）` : `${ids.length} 件を却下しました`
    );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const n = candidates.filter((c) => {
            const matches = t.key === "all" ? true : t.key === "approved" ? c.status === "approved" || c.status === "writing" : c.status === t.key;
            return matches && (showPublished || !isPublished(c));
          }).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setSelected(new Set());
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                tab === t.key ? "bg-pomie-500 text-white" : "bg-white text-ink-700 ring-1 ring-ink-100 hover:bg-pomie-100"
              }`}
            >
              {t.label} <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
        {publishedCount > 0 && (
          <button type="button" onClick={() => setShowPublished((v) => !v)} className="text-xs text-ink-500 hover:text-pomie-600">
            {showPublished ? "公開済みの候補を隠す" : `公開済みの候補も表示（${publishedCount}）`}
          </button>
        )}
        {feedback && <span className="ml-auto text-xs text-ink-700">{feedback}</span>}
      </div>

      {tab === "proposed" && visible.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-pomie-50 p-3 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={selected.size === visible.length}
              onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((c) => c.id)) : new Set())}
            />
            すべて選択
          </label>
          <span className="text-ink-500">{selected.size} 件選択中</span>
          <button
            type="button"
            disabled={pending || selected.size === 0}
            onClick={() => decide([...selected], "approved")}
            className="rounded-full bg-pomie-500 px-3 py-1 font-semibold text-white disabled:opacity-50"
          >
            選択を承認
          </button>
          <button
            type="button"
            disabled={pending || selected.size === 0}
            onClick={() => decide([...selected], "rejected")}
            className="rounded-full border border-ink-100 bg-white px-3 py-1 font-semibold text-ink-700 disabled:opacity-50"
          >
            選択を却下
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-6 rounded-lg bg-white p-6 text-center text-sm text-ink-500 ring-1 ring-ink-100">
          {tab === "proposed"
            ? "提案中の候補はありません。次回の自動実行（週 1 回）で追加されます。"
            : "該当する候補はありません。"}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((c) => {
            const intent = c.intent ? INTENT_LABEL[c.intent] : null;
            const isProposed = c.status === "proposed";
            return (
              <li key={c.id} className="rounded-xl bg-white p-4 ring-1 ring-ink-100">
                <div className="flex flex-wrap items-start gap-3">
                  {isProposed && (
                    <input
                      type="checkbox"
                      className="mt-1.5"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold">{c.keyword}</h3>
                      {intent && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${intent.className}`}>
                          {intent.label}
                        </span>
                      )}
                      {c.category && <span className="chip">{c.category}</span>}
                      {c.score !== null && (
                        <span className="text-[11px] text-ink-500">スコア {Math.round(c.score)}</span>
                      )}
                      {!isProposed && (
                        <span className="ml-auto text-[11px] font-semibold text-ink-500">{STATUS_LABEL[c.status]}</span>
                      )}
                    </div>

                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-700">
                      <Metric k="月間検索数" v={c.searchVolume == null ? "不明" : c.searchVolume.toLocaleString()} />
                      <Metric k="SEO 難易度" v={difficultyLabel(c.seoDifficulty)} />
                      <Metric k="広告競合" v={c.competition === null ? "不明" : String(c.competition)} />
                      {c.seed && <Metric k="種" v={c.seed} />}
                    </dl>

                    {c.suggestedTitle && (
                      <p className="mt-3 text-sm">
                        <span className="text-xs font-semibold text-ink-500">タイトル案　</span>
                        {c.suggestedTitle}
                      </p>
                    )}
                    {c.angle && (
                      <p className="mt-1 text-sm text-ink-700">
                        <span className="text-xs font-semibold text-ink-500">切り口　</span>
                        {c.angle}
                      </p>
                    )}
                    {c.faqQuestions.length > 0 && (
                      <p className="mt-1 text-xs text-ink-500">
                        よくある質問: {c.faqQuestions.slice(0, 3).join(" / ")}
                        {c.faqQuestions.length > 3 && ` ほか ${c.faqQuestions.length - 3} 件`}
                      </p>
                    )}
                    {c.targetStylistIds.length > 0 && (
                      <p className="mt-1 text-xs text-ink-500">
                        紹介する美容師: {c.targetStylistIds.map((id) => stylistName.get(id) ?? id).join("、")}
                      </p>
                    )}
                    {c.reason && <p className="mt-1 text-xs text-ink-500">理由: {c.reason}</p>}
                    {c.error && (
                      <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">エラー: {c.error}</p>
                    )}
                    {c.note && !isProposed && <p className="mt-1 text-xs text-ink-700">メモ: {c.note}</p>}

                    {isProposed && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          value={notes[c.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                          placeholder="執筆への指示メモ（任意。例: 40 代向けに、料金は控えめに）"
                          className="input max-w-md text-xs"
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => decide([c.id], "approved")}
                          className="rounded-full bg-pomie-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-pomie-600 disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => decide([c.id], "rejected")}
                          className="rounded-full border border-ink-100 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 hover:bg-pomie-100 disabled:opacity-50"
                        >
                          却下
                        </button>
                      </div>
                    )}
                    {c.status === "approved" && (
                      <div className="mt-3">
                        <RunJobButton kind="write" targetId={c.id} label="この候補をいま記事にする（API）" />
                      </div>
                    )}
                    {(c.status === "failed" || c.status === "rejected") && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => retryKeywordCandidate(c.id), "承認（記事化待ち）に戻しました")}
                          className="rounded-full bg-pomie-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-pomie-600 disabled:opacity-50"
                        >
                          {c.status === "failed" ? "再試行（承認に戻す）" : "承認に戻す"}
                        </button>
                        {c.status === "failed" && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => decide([c.id], "rejected")}
                            className="rounded-full border border-ink-100 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 disabled:opacity-50"
                          >
                            却下
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`「${c.keyword}」を候補から削除します。よろしいですか？`)) {
                              run(() => deleteKeywordCandidate(c.id), "削除しました");
                            }
                          }}
                          className="ml-auto text-xs text-ink-500 hover:text-red-600"
                        >
                          削除
                        </button>
                      </div>
                    )}
                    {c.status === "approved" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-ink-500">次回の自動実行で記事になります。</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => decide([c.id], "rejected")}
                          className="text-ink-500 hover:text-red-600"
                        >
                          承認を取り消す
                        </button>
                      </div>
                    )}
                    {c.status === "written" && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        {c.articleId && articles[c.articleId] ? (
                          <>
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${
                                articles[c.articleId].status === "published" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {articles[c.articleId].status === "published" ? "記事: 公開済み" : "記事: 下書き（公開待ち）"}
                            </span>
                            <span className="text-ink-700">{articles[c.articleId].title}</span>
                            {articles[c.articleId].status === "published" ? (
                              <>
                                <a href={`/articles/${articles[c.articleId].slug}`} target="_blank" rel="noreferrer" className="text-pomie-600 hover:underline">
                                  公開ページ ↗
                                </a>
                                <Link href={`/admin/articles/${c.articleId}/edit`} className="text-pomie-600 hover:underline">
                                  編集・リライト
                                </Link>
                              </>
                            ) : (
                              <>
                                <Link href={`/admin/articles/${c.articleId}/edit`} className="font-semibold text-pomie-600 hover:underline">
                                  記事を確認・承認する →
                                </Link>
                                <a href={`/admin/articles/${c.articleId}/preview`} target="_blank" rel="noreferrer" className="text-pomie-600 hover:underline">
                                  プレビュー ↗
                                </a>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="rounded-full bg-ink-100 px-2 py-0.5 font-semibold text-ink-500">記事: 見つかりません（削除された可能性）</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="inline text-ink-500">{k}: </dt>
      <dd className="inline font-medium">{v}</dd>
    </div>
  );
}
