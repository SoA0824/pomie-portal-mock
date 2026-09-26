"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { saveArticle, deleteArticle } from "@/server/actions/articles";
import {
  ARTICLE_CATEGORIES,
  type Article,
  type ArticleCategory,
  type ArticleStatus,
} from "@/lib/types";

export type StylistOption = { id: string; name: string; storeName: string; active: boolean };

const REASON_LABELS: Record<string, string> = {
  missing_title: "タイトルを入力してください",
  invalid_slug: "URL は半角英小文字・数字・ハイフンで入力してください（例: omotesando-hair-care）",
  duplicate_slug: "この URL は他の記事で使われています。別の URL にしてください",
  invalid_category: "カテゴリを選んでください",
  missing_summary_for_publish: "公開するには概要（リード文）を入力してください",
  missing_body_for_publish: "公開するには本文を入力してください",
  article_not_found: "記事が見つかりません（削除された可能性があります）",
};

/** datetime-local 用（ローカル時刻の YYYY-MM-DDTHH:mm） */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ArticleForm({
  initial,
  stylists,
}: {
  initial?: Article;
  stylists: StylistOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  // 画像の保存先キー（新規は一時 ID）
  const [imageKey] = useState(
    () => initial?.id ?? `draft-${Math.random().toString(36).slice(2, 10)}`
  );

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    summary: initial?.summary ?? "",
    body: initial?.body ?? "",
    category: (initial?.category ?? ARTICLE_CATEGORIES[0]) as ArticleCategory,
    coverImage: initial?.coverImage ?? "",
    targetKeyword: initial?.targetKeyword ?? "",
    status: (initial?.status ?? "draft") as ArticleStatus,
    // 公開済みの記事だけ公開日時を表示・編集する
    publishedAt: initial?.status === "published" ? toLocalInput(initial.publishedAt) : "",
  });
  const [related, setRelated] = useState<string[]>(initial?.relatedStylistIds ?? []);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
    setError(null);
  };

  const toggleStylist = (id: string) =>
    setRelated((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveArticle({
        id: initial?.id,
        ...form,
        relatedStylistIds: related,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined,
      });
      if (result.ok) {
        router.push("/admin/articles");
        router.refresh();
      } else {
        setError(REASON_LABELS[result.reason] ?? `保存に失敗しました（${result.reason}）`);
      }
    });
  };

  const remove = () => {
    if (!initial) return;
    if (!window.confirm(`「${initial.title}」を削除します。元に戻せません。よろしいですか？`)) return;
    startTransition(async () => {
      const result = await deleteArticle(initial.id);
      if (result.ok) {
        router.push("/admin/articles");
        router.refresh();
      } else {
        setError(REASON_LABELS[result.reason] ?? `削除に失敗しました（${result.reason}）`);
      }
    });
  };

  const bodyChars = form.body.replace(/\s/g, "").length;

  return (
    <form onSubmit={submit} className="card space-y-6 p-6">
      <Field label="タイトル" required>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          className="input"
          placeholder="例: 表参道で髪質改善をするなら。失敗しない美容師の選び方"
        />
        <Hint>{form.title.length} 文字（検索結果では 30 文字前後まで表示されます）</Hint>
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="URL（スラッグ）" required>
          <div className="flex items-center gap-1 text-sm text-ink-500">
            <span className="shrink-0">/articles/</span>
            <input
              value={form.slug}
              onChange={(e) => update("slug", e.target.value.toLowerCase())}
              className="input"
              placeholder="omotesando-hair-care"
            />
          </div>
          <Hint>半角英小文字・数字・ハイフン。内容が分かる英単語にするのがおすすめ。公開後は変えないでください。</Hint>
        </Field>
        <Field label="カテゴリ" required>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value as ArticleCategory)}
            className="input"
          >
            {ARTICLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="狙う検索キーワード">
        <input
          value={form.targetKeyword}
          onChange={(e) => update("targetKeyword", e.target.value)}
          className="input"
          placeholder="例: 表参道 髪質改善 美容師"
        />
        <Hint>サイトには表示されません。記事の狙いの管理と、後の効果測定に使います。</Hint>
      </Field>

      <Field label="概要（リード文）">
        <textarea
          value={form.summary}
          onChange={(e) => update("summary", e.target.value)}
          className="input min-h-[80px]"
          placeholder="記事一覧のカードと、検索結果の説明文に使われます"
        />
        <Hint>{form.summary.length} 文字（80〜120 文字が目安）・公開時は必須</Hint>
      </Field>

      <Field label="カバー画像">
        <ImageUploadField
          value={form.coverImage}
          onChange={(url) => update("coverImage", url)}
          folder="articles"
          ownerKey={imageKey}
          previewShape="wide"
        />
        <Hint>横長（2:1 程度）がおすすめ。空欄ならトップのメインビジュアルを使います。</Hint>
      </Field>

      {/* 本文（Markdown）: 編集 / プレビュー切替 */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-700">
            本文（Markdown）<span className="ml-2 font-normal text-ink-500">{bodyChars} 文字</span>
          </span>
          <div className="inline-flex overflow-hidden rounded-full ring-1 ring-pomie-200 text-xs">
            {(["edit", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1 font-semibold ${
                  tab === t ? "bg-pomie-500 text-white" : "bg-white text-ink-700 hover:bg-pomie-100"
                }`}
              >
                {t === "edit" ? "編集" : "プレビュー"}
              </button>
            ))}
          </div>
        </div>
        {tab === "edit" ? (
          <>
            <textarea
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
              className="input mt-2 min-h-[420px] font-mono text-[13px] leading-relaxed"
              placeholder={"## 見出し\n\n本文を書きます。**太字**、- 箇条書き、[リンク](https://...) が使えます。"}
            />
            <Hint>
              見出しは「## 」（大見出し）「### 」（小見出し）、箇条書きは「- 」で始めます。公開時は必須。
            </Hint>
          </>
        ) : (
          <div className="markdown mt-2 min-h-[420px] rounded-lg border border-ink-100 bg-white p-5">
            {form.body.trim() ? (
              <ReactMarkdown>{form.body}</ReactMarkdown>
            ) : (
              <p className="text-sm text-ink-500">本文がまだありません。</p>
            )}
          </div>
        )}
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-ink-700">
          この記事で紹介する美容師
          <span className="ml-2 font-normal text-ink-500">
            （{related.length} 名選択）— 記事の下に美容師カードが表示され、予約へつながります
          </span>
        </legend>
        {stylists.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">登録されている美容師がいません。</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stylists.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 transition ${
                  related.includes(s.id)
                    ? "bg-pomie-50 ring-pomie-400"
                    : "bg-white ring-ink-100 hover:bg-pomie-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={related.includes(s.id)}
                  onChange={() => toggleStylist(s.id)}
                />
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-ink-500">{s.storeName}</span>
                {!s.active && <span className="text-[10px] text-ink-500">（非公開）</span>}
              </label>
            ))}
          </div>
        )}
        <Hint>非公開の美容師は、選んでも記事には表示されません。</Hint>
      </fieldset>

      <div className="grid gap-5 border-t border-ink-100 pt-5 md:grid-cols-2">
        <fieldset>
          <legend className="text-xs font-semibold text-ink-700">公開状態</legend>
          <div className="mt-1 flex gap-4 text-sm">
            {(
              [
                ["draft", "下書き（非公開）"],
                ["published", "公開"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="status"
                  checked={form.status === value}
                  onChange={() => update("status", value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {form.status === "published" && (
          <Field label="公開日時">
            <input
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => update("publishedAt", e.target.value)}
              className="input"
            />
            <Hint>空欄なら保存した時刻で公開されます。</Hint>
          </Field>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "保存中..." : form.status === "published" ? "保存して公開" : "下書き保存"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/articles")}
          disabled={pending}
          className="btn-secondary"
        >
          キャンセル
        </button>
        {initial && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-auto text-sm text-ink-500 hover:text-red-600"
          >
            この記事を削除
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-ink-700">
        {label}
        {required && <span className="ml-1 text-pomie-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-ink-500">{children}</p>;
}
