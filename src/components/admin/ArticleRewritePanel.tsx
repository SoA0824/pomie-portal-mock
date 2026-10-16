"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyRevision, rejectRevision, requestRewrite } from "@/server/actions/revisions";
import { diffLines, diffStats, type DiffLine } from "@/lib/textDiff";
import { getAreaBySlug } from "@/lib/areas";
import type { Article, ArticleRevision, RevisionStatus } from "@/lib/types";
import type { StylistOption } from "@/components/admin/ArticleForm";
import { formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<RevisionStatus, { label: string; className: string }> = {
  requested: { label: "依頼済み（リライト待ち）", className: "bg-amber-100 text-amber-800" },
  proposed: { label: "提案あり（承認待ち）", className: "bg-pomie-100 text-pomie-700" },
  applied: { label: "反映済み", className: "bg-green-100 text-green-800" },
  rejected: { label: "却下", className: "bg-ink-100 text-ink-500" },
  failed: { label: "失敗", className: "bg-red-100 text-red-700" },
};

/** よく使う指示（クリックで指示欄に追記） */
const PRESETS = [
  "検索で上位に出るよう、足りない情報や見出しを補ってください（今の構成と主張は残す）",
  "料金・メニュー・美容師の情報を最新の内容に合わせてください",
  "読みやすさを改善してください（内容は大きく変えない）",
  "よくある質問を、実際に検索されている質問で見直してください",
];

export function ArticleRewritePanel({
  article,
  revisions,
  stylists,
  loadError,
}: {
  article: Article;
  revisions: ArticleRevision[];
  stylists: StylistOption[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [remove, setRemove] = useState<string[]>([]);
  const [add, setAdd] = useState<string[]>([]);

  const nameOf = useMemo(() => new Map(stylists.map((s) => [s.id, s.name])), [stylists]);
  const current = new Set(article.relatedStylistIds);
  const addable = stylists.filter((s) => s.active && !current.has(s.id));
  const open = revisions.filter((r) => r.status === "requested" || r.status === "proposed");
  const closed = revisions.filter((r) => !(r.status === "requested" || r.status === "proposed"));

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>, done: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setMessage(done);
        after?.();
        router.refresh();
      } else {
        setMessage(`失敗しました: ${r.reason}`);
      }
    });
  };

  const submit = () =>
    run(
      () => requestRewrite({ articleId: article.id, instruction, removeStylistIds: remove, addStylistIds: add }),
      "リライトを依頼しました。Claude Code で /rewrite-article を実行すると提案が作られます",
      () => {
        setInstruction("");
        setRemove([]);
        setAdd([]);
      }
    );

  const apply = (rev: ArticleRevision) => {
    setMessage(null);
    startTransition(async () => {
      let r = await applyRevision(rev.id);
      if (!r.ok && r.reason === "conflict" && "message" in r) {
        if (!window.confirm(`${r.message}\nこのまま反映しますか？`)) return;
        r = await applyRevision(rev.id, { force: true });
      }
      if (r.ok) {
        setMessage(article.status === "published" ? "反映しました（公開中の記事に反映されています）" : "反映しました");
        router.refresh();
      } else {
        setMessage(`失敗しました: ${r.reason}`);
      }
    });
  };

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">リライト</h2>
          <p className="mt-1 text-xs text-ink-500">
            指示を出すと、状況を分析したうえで原型を保ったリライト案が作られます。案は差分を確認して
            「承認して反映」したときだけ記事に反映されます（URL は変わりません）。
          </p>
        </div>
        {message && <span className="text-xs text-ink-700">{message}</span>}
      </div>

      {loadError ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          リライトの履歴を読み込めませんでした（{loadError}）。Supabase で
          <code className="mx-1">supabase/migration-012-article-revisions.sql</code>を実行してください。
        </p>
      ) : (
        <>
          {/* 依頼フォーム */}
          <div className="mt-4 space-y-3 rounded-xl bg-pomie-50/60 p-4">
            <label className="block text-xs font-semibold text-ink-700">リライトの指示</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="input min-h-[90px] text-sm"
              placeholder="例: 「表参道 ヘッドスパ 専門店」でも検索されるよう、専門店との違いの章を厚くしてください"
            />
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setInstruction((v) => (v.trim() ? `${v.trim()}\n${p}` : p))}
                  className="rounded-full bg-white px-3 py-1 text-[11px] text-ink-700 ring-1 ring-pomie-200 hover:bg-pomie-100"
                >
                  + {p.slice(0, 18)}…
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-ink-700">紹介から外す美容師</p>
                {article.relatedStylistIds.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-500">紹介中の美容師はいません</p>
                ) : (
                  <div className="mt-1 space-y-1 text-sm">
                    {article.relatedStylistIds.map((id) => {
                      const s = stylists.find((x) => x.id === id);
                      return (
                        <label key={id} className="flex items-center gap-2">
                          <input type="checkbox" checked={remove.includes(id)} onChange={() => toggle(remove, setRemove, id)} />
                          {nameOf.get(id) ?? id}
                          {s && !s.active && <span className="text-[11px] text-red-600">（非公開）</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-700">紹介に加える美容師</p>
                {addable.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-500">追加できる美容師はいません</p>
                ) : (
                  <div className="mt-1 space-y-1 text-sm">
                    {addable.map((s) => (
                      <label key={s.id} className="flex items-center gap-2">
                        <input type="checkbox" checked={add.includes(s.id)} onChange={() => toggle(add, setAdd, s.id)} />
                        {s.name}
                        <span className="text-[11px] text-ink-500">{s.storeName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-ink-500">
              美容師を差し替えると、本文の紹介文・リンク・記事下の美容師カードがまとめて書き換わります。
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={pending || (!instruction.trim() && remove.length === 0 && add.length === 0)}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {pending ? "送信中..." : "リライトを依頼"}
            </button>
          </div>

          {/* 進行中 */}
          {open.length > 0 && (
            <div className="mt-6 space-y-4">
              {open.map((rev) => (
                <RevisionCard
                  key={rev.id}
                  rev={rev}
                  article={article}
                  nameOf={nameOf}
                  pending={pending}
                  onApply={() => apply(rev)}
                  onReject={() => run(() => rejectRevision(rev.id), rev.status === "requested" ? "依頼を取り消しました" : "却下しました")}
                />
              ))}
            </div>
          )}

          {/* 履歴 */}
          {closed.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-xs font-semibold text-ink-500">これまでのリライト（{closed.length} 件）</summary>
              <ul className="mt-2 space-y-2 text-xs">
                {closed.map((rev) => (
                  <li key={rev.id} className="rounded-lg bg-white p-3 ring-1 ring-ink-100">
                    <span className={`mr-2 rounded-full px-2 py-0.5 font-semibold ${STATUS_LABEL[rev.status].className}`}>
                      {STATUS_LABEL[rev.status].label}
                    </span>
                    <span className="text-ink-500">{formatDateTime(rev.decidedAt ?? rev.requestedAt)}</span>
                    <p className="mt-1 whitespace-pre-wrap text-ink-700">{rev.changeSummary ?? rev.instruction}</p>
                    {rev.error && <p className="mt-1 text-red-700">エラー: {rev.error}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function RevisionCard({
  rev,
  article,
  nameOf,
  pending,
  onApply,
  onReject,
}: {
  rev: ArticleRevision;
  article: Article;
  nameOf: Map<string, string>;
  pending: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const names = (ids: string[] | undefined | null) => (ids ?? []).map((id) => nameOf.get(id) ?? id).join("、") || "なし";
  const areaNames = (slugs: string[] | undefined | null) =>
    (slugs ?? []).map((s) => getAreaBySlug(s)?.name ?? s).join("・") || "なし";
  const body = useMemo(
    () => (rev.proposedBody ? diffLines(article.body.trim(), rev.proposedBody.trim()) : []),
    [article.body, rev.proposedBody]
  );
  const stats = diffStats(body);

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-ink-100">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_LABEL[rev.status].className}`}>
          {STATUS_LABEL[rev.status].label}
        </span>
        <span className="text-ink-500">依頼 {formatDateTime(rev.requestedAt)}</span>
        {rev.proposedAt && <span className="text-ink-500">・提案 {formatDateTime(rev.proposedAt)}</span>}
      </div>
      {rev.instruction && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-900">指示: {rev.instruction}</p>}
      {((rev.stylistSwap.remove ?? []).length > 0 || (rev.stylistSwap.add ?? []).length > 0) && (
        <p className="mt-1 text-xs text-ink-700">
          美容師の差し替え: 外す {names(rev.stylistSwap.remove)} ／ 加える {names(rev.stylistSwap.add)}
        </p>
      )}

      {rev.status === "requested" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-ink-500">Claude Code で <code>/rewrite-article</code> を実行すると、この依頼のリライト案が作られます。</span>
          <button type="button" onClick={onReject} disabled={pending} className="text-ink-500 hover:text-red-600">
            依頼を取り消す
          </button>
        </div>
      )}

      {rev.status === "proposed" && (
        <div className="mt-3 space-y-3">
          {rev.analysis && (
            <div className="rounded-lg bg-pomie-50 p-3 text-xs">
              <p className="font-semibold text-ink-700">分析</p>
              <p className="mt-1 whitespace-pre-wrap text-ink-700">{rev.analysis}</p>
            </div>
          )}
          {rev.changeSummary && (
            <div className="rounded-lg bg-pomie-50 p-3 text-xs">
              <p className="font-semibold text-ink-700">変更点</p>
              <p className="mt-1 whitespace-pre-wrap text-ink-700">{rev.changeSummary}</p>
            </div>
          )}
          {(rev.lint?.warnings?.length ?? 0) > 0 && (
            <p className="text-[11px] text-ink-500">検品の注意: {rev.lint?.warnings?.join(" / ")}</p>
          )}

          <dl className="space-y-1 text-xs">
            <Change label="タイトル" before={article.title} after={rev.proposedTitle} />
            <Change label="概要" before={article.summary} after={rev.proposedSummary} />
            <Change label="カテゴリ" before={article.category} after={rev.proposedCategory} />
            <Change label="紹介する美容師" before={names(article.relatedStylistIds)} after={rev.proposedRelatedStylistIds ? names(rev.proposedRelatedStylistIds) : null} />
            <Change label="エリア" before={areaNames(article.areas)} after={rev.proposedAreas ? areaNames(rev.proposedAreas) : null} />
          </dl>

          <details open>
            <summary className="cursor-pointer text-xs font-semibold text-ink-700">
              本文の差分（追加 {stats.added} 行 / 削除 {stats.removed} 行）
            </summary>
            <DiffView lines={body} />
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onApply} disabled={pending} className="btn-primary text-sm disabled:opacity-50">
              {article.status === "published" ? "承認して反映（公開中の記事を更新）" : "承認して反映"}
            </button>
            <button type="button" onClick={onReject} disabled={pending} className="btn-secondary text-sm">
              却下
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Change({ label, before, after }: { label: string; before: string; after: string | null }) {
  if (after === null || after === undefined || after.trim() === before.trim()) {
    return (
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-ink-500">{label}</dt>
        <dd className="text-ink-500">変更なし</dd>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-ink-500">{label}</dt>
      <dd>
        <span className="bg-red-50 text-red-700 line-through">{before || "（空）"}</span>
        <span className="mx-1 text-ink-500">→</span>
        <span className="bg-green-50 text-green-800">{after}</span>
      </dd>
    </div>
  );
}

/** 変更の前後 2 行だけを残し、長い「変更なし」は折りたたむ */
function DiffView({ lines }: { lines: DiffLine[] }) {
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.type !== "same") for (let k = i - 2; k <= i + 2; k++) keep.add(k);
  });
  const rows: Array<{ kind: "line"; line: DiffLine } | { kind: "gap"; count: number }> = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (keep.has(i)) {
      if (gap) rows.push({ kind: "gap", count: gap });
      gap = 0;
      rows.push({ kind: "line", line: l });
    } else {
      gap++;
    }
  });
  if (gap) rows.push({ kind: "gap", count: gap });

  if (!lines.some((l) => l.type !== "same")) {
    return <p className="mt-2 text-xs text-ink-500">本文の変更はありません。</p>;
  }
  return (
    <div className="mt-2 max-h-[520px] overflow-auto rounded-lg ring-1 ring-ink-100">
      <pre className="whitespace-pre-wrap break-words p-0 font-mono text-[12px] leading-relaxed">
        {rows.map((r, i) =>
          r.kind === "gap" ? (
            <div key={i} className="bg-ink-100/40 px-3 py-0.5 text-center text-[11px] text-ink-500">
              … {r.count} 行 変更なし …
            </div>
          ) : (
            <div
              key={i}
              className={`px-3 ${
                r.line.type === "add" ? "bg-green-50 text-green-900" : r.line.type === "del" ? "bg-red-50 text-red-800 line-through" : "text-ink-700"
              }`}
            >
              <span className="mr-2 select-none text-ink-300">{r.line.type === "add" ? "+" : r.line.type === "del" ? "−" : " "}</span>
              {r.line.text || " "}
            </div>
          )
        )}
      </pre>
    </div>
  );
}
