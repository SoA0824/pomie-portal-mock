"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectIntegration, disconnectIntegration, refreshIntegration } from "@/server/actions/integrations";
import { PLATFORM_LABEL } from "@/lib/social/labels";
import { formatDateTime } from "@/lib/format";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/types";

const GUIDE: Record<IntegrationProvider, { permissions: string; steps: string[] }> = {
  instagram: {
    permissions: "instagram_business_basic / instagram_business_content_publish",
    steps: [
      "https://developers.facebook.com でアプリを作成する（ユースケース「Instagram のコンテンツを管理」、種類「ビジネス」）",
      "アプリのダッシュボード → Instagram →「Instagram ログインの API 設定」で、Instagram テスターに POMiE のアカウントを追加する",
      "Instagram アプリ → 設定 →「アプリとウェブサイト」→「テスター招待」で承認する",
      "ダッシュボードの「アクセストークンを生成」で出たトークンを下に貼る（60 日有効。以後は自動で更新）",
    ],
  },
  threads: {
    permissions: "threads_basic / threads_content_publish",
    steps: [
      "同じアプリに「Threads API」の製品（ユースケース「Threads API にアクセス」）を追加する",
      "Threads テスターに POMiE の Threads アカウントを追加する",
      "Threads アプリ → 設定 → アカウント →「ウェブサイトのアクセス許可」→「招待」で承認する",
      "「アクセストークンを生成」で出たトークンを下に貼る（60 日有効。以後は自動で更新）",
    ],
  },
};

export function IntegrationSettings({ statuses, secretConfigured, loadError }: { statuses: IntegrationStatus[]; secretConfigured: boolean; loadError: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tokens, setTokens] = useState<Partial<Record<IntegrationProvider, string>>>({});
  const [message, setMessage] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; reason?: string; message?: string }>, done: string) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setMessage(r.message ?? done);
        router.refresh();
      } else {
        setMessage(`失敗しました: ${r.reason}`);
      }
    });
  };

  return (
    <div className="mt-4 space-y-4">
      {!secretConfigured && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          トークンを暗号化して保存するための <code className="rounded bg-white px-1">INTEGRATION_SECRET</code> が Vercel に設定されていません。
          Environment Variables に 32 文字以上のランダムな文字列を追加して再デプロイしてください（あわせて <code className="rounded bg-white px-1">CRON_SECRET</code>{" "}
          も設定すると、トークンの自動更新が毎日動きます）。
        </div>
      )}
      {loadError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          連携情報を読み込めませんでした（{loadError}）。<code className="rounded bg-white px-1">supabase/migration-014-social-publish.sql</code> を実行してください。
        </div>
      )}
      {message && <p className="rounded-lg bg-pomie-50 px-3 py-2 text-xs text-pomie-700">{message}</p>}

      {statuses.map((s) => {
        const guide = GUIDE[s.provider];
        const daysLeft = s.expiresAt ? Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 86400000) : null;
        return (
          <section key={s.provider} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-ink-900">{PLATFORM_LABEL[s.provider]}</h2>
              {s.connected ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">接続中{s.accountName ? ` @${s.accountName}` : ""}</span>
              ) : (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500">未接続</span>
              )}
            </div>
            {s.connected && (
              <p className="mt-1 text-xs text-ink-500">
                有効期限 {s.expiresAt ? formatDateTime(s.expiresAt) : "不明"}
                {daysLeft !== null && <span className={daysLeft < 7 ? " font-semibold text-red-700" : ""}>（あと {daysLeft} 日）</span>}
                {s.refreshedAt && <span> ・ 最終更新 {formatDateTime(s.refreshedAt)}</span>}
              </p>
            )}
            {s.lastError && <p className="mt-1 text-xs text-red-700">{s.lastError}</p>}

            <details className="mt-3 text-xs text-ink-700">
              <summary className="cursor-pointer text-pomie-600">トークンの取り方（Meta for Developers。画面の名称は変わることがあります）</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {guide.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <p className="mt-2 text-ink-500">必要な権限: {guide.permissions}。アプリは「開発モード」のままで、自分のアカウントには投稿できます（審査は不要）。</p>
            </details>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="password"
                className="input w-full max-w-md"
                placeholder={s.connected ? "入れ直すときは新しいトークンを貼る" : "アクセストークンを貼り付け"}
                value={tokens[s.provider] ?? ""}
                onChange={(e) => setTokens((cur) => ({ ...cur, [s.provider]: e.target.value }))}
                autoComplete="off"
              />
              <button
                type="button"
                disabled={pending || !secretConfigured || !(tokens[s.provider] ?? "").trim()}
                onClick={() =>
                  run(
                    () => connectIntegration(s.provider, tokens[s.provider] ?? ""),
                    "接続しました"
                  )
                }
                className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50"
              >
                {s.connected ? "入れ直す" : "接続する"}
              </button>
              {s.connected && (
                <>
                  <button type="button" disabled={pending} onClick={() => run(() => refreshIntegration(s.provider), "更新しました")} className="btn-secondary px-4 py-1.5 text-xs disabled:opacity-50">
                    トークンを更新
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => window.confirm(`${PLATFORM_LABEL[s.provider]} の連携を解除しますか？`) && run(() => disconnectIntegration(s.provider), "解除しました")}
                    className="text-xs text-red-700 hover:underline"
                  >
                    解除
                  </button>
                </>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
