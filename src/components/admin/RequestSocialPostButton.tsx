"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestSocialPost } from "@/server/actions/social";
import type { SocialPlatform } from "@/lib/types";

/**
 * 記事一覧の「SNS 投稿を作る」。
 * 依頼として保存し、Claude Code の /make-social-post が投稿文・スライド・画像を作る。
 */
export function RequestSocialPostButton({ articleId, articleTitle }: { articleId: string; articleTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["instagram", "x"]);
  const [brief, setBrief] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentNote, setConsentNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const toggle = (p: SocialPlatform) => setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const r = await requestSocialPost({
        articleId,
        platforms,
        brief,
        photoConsent: consent ? consentNote.trim() || "本人の了承あり" : undefined,
      });
      if (r.ok) {
        setDoneId(r.id);
        setOpen(false);
        router.refresh();
      } else {
        setError(r.reason);
      }
    });
  };

  if (doneId) {
    return (
      <p className="text-[11px] text-ink-700">
        SNS 投稿を依頼しました。Claude Code で <code className="rounded bg-ink-100 px-1">/make-social-post</code> を実行してください ・{" "}
        <Link href={`/admin/social/${doneId}`} className="text-pomie-600 hover:underline">
          開く
        </Link>
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-pomie-600 hover:underline">
        SNS 投稿を作る
      </button>
    );
  }

  return (
    <div className="mt-1 w-72 space-y-2 rounded-lg border border-pomie-200 bg-pomie-50 p-3 text-xs">
      <p className="font-semibold text-ink-900">SNS 投稿を作る</p>
      <p className="text-[11px] text-ink-500">「{articleTitle}」をもとに投稿文とスライドを作ります。</p>
      <div className="flex gap-3">
        {(["instagram", "x"] as SocialPlatform[]).map((p) => (
          <label key={p} className="flex items-center gap-1">
            <input type="checkbox" checked={platforms.includes(p)} onChange={() => toggle(p)} />
            {p === "instagram" ? "Instagram" : "X"}
          </label>
        ))}
      </div>
      <textarea
        className="input min-h-[56px] text-xs"
        placeholder="ひとこと指示（任意）例: 冬の乾燥の話題を入れて / 20 代向けに"
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
      />
      <label className="flex items-start gap-1 text-[11px] text-ink-700">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>紹介する美容師本人の写真を使ってよい（了承を得ている）</span>
      </label>
      {consent && (
        <input
          className="input text-xs"
          placeholder="了承のメモ（例: 10/15 LINE で確認）"
          value={consentNote}
          onChange={(e) => setConsentNote(e.target.value)}
        />
      )}
      {error && <p className="text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50">
          {pending ? "依頼中…" : "依頼する"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-4 py-1.5 text-xs">
          やめる
        </button>
      </div>
    </div>
  );
}
