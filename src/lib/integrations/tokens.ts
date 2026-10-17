/**
 * 連携トークンの保存・取得・更新（integration_tokens テーブル）。
 * トークンは暗号化して保存し、使うときだけ復号する。
 */
import { getSupabase, type IntegrationTokenRow } from "@/lib/supabase/client";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/types";
import { INTEGRATION_PROVIDERS } from "@/lib/types";
import { decryptSecret, encryptSecret, integrationSecretConfigured } from "./secrets";
import { exchangeToken, refreshToken, verifyToken } from "./meta";

const LONG_LIVED_DAYS = 60;
/** 前回の更新からこれだけたっていたら更新する（有効期限 60 日に対して余裕をもって） */
const REFRESH_AFTER_DAYS = 7;

function now() {
  return new Date().toISOString();
}

function addDays(days: number, from = Date.now()) {
  return new Date(from + days * 86400000).toISOString();
}

export async function getIntegrationRow(provider: IntegrationProvider): Promise<IntegrationTokenRow | null> {
  const { data, error } = await getSupabase().from("integration_tokens").select("*").eq("provider", provider).maybeSingle();
  if (error) return null;
  return (data as IntegrationTokenRow | null) ?? null;
}

/** 管理画面の表示用（トークン自体は返さない） */
/**
 * 長期トークンへの交換に使うシークレット。Instagram は「Instagram ログインによる API 設定」画面の
 * Instagram app secret、Threads は Threads ユースケースの Threads App Secret（アプリ全体のシークレットとは別）。
 */
export function appSecretFor(provider: IntegrationProvider): string | undefined {
  return (provider === "instagram" ? process.env.INSTAGRAM_APP_SECRET : process.env.THREADS_APP_SECRET) || process.env.META_APP_SECRET || undefined;
}

export function appSecretConfigured(): Record<IntegrationProvider, boolean> {
  return { instagram: Boolean(appSecretFor("instagram")), threads: Boolean(appSecretFor("threads")) };
}

export async function listIntegrationStatus(): Promise<{
  statuses: IntegrationStatus[];
  secretConfigured: boolean;
  appSecretConfigured: Record<IntegrationProvider, boolean>;
  error: string | null;
}> {
  const { data, error } = await getSupabase().from("integration_tokens").select("provider, account_id, account_name, expires_at, refreshed_at, last_error, updated_at");
  const rows = (data ?? []) as Array<Omit<IntegrationTokenRow, "token_enc" | "created_at">>;
  const statuses = INTEGRATION_PROVIDERS.map((provider) => {
    const r = rows.find((x) => x.provider === provider);
    return {
      provider,
      connected: Boolean(r),
      accountId: r?.account_id ?? null,
      accountName: r?.account_name ?? null,
      expiresAt: r?.expires_at ?? null,
      refreshedAt: r?.refreshed_at ?? null,
      lastError: r?.last_error ?? null,
    };
  });
  return { statuses, secretConfigured: integrationSecretConfigured(), appSecretConfigured: appSecretConfigured(), error: error?.message ?? null };
}

/**
 * トークンを確認して保存する（管理画面の「接続」）。
 * META_APP_SECRET があれば長期トークンへの交換を試す（短期トークンを貼られても 60 日もつようにする）。
 */
export async function saveIntegrationToken(provider: IntegrationProvider, token: string): Promise<IntegrationStatus & { exchanged: boolean }> {
  let trimmed = token.trim();
  if (!trimmed) throw new Error("トークンを入力してください");
  const account = await verifyToken(provider, trimmed);
  let expiresAt = addDays(LONG_LIVED_DAYS);
  let exchanged = false;
  const appSecret = appSecretFor(provider);
  if (appSecret) {
    try {
      const ex = await exchangeToken(provider, trimmed, appSecret);
      trimmed = ex.token;
      expiresAt = new Date(Date.now() + ex.expiresIn * 1000).toISOString();
      exchanged = true;
    } catch {
      // すでに長期トークン（交換不要）か、交換に対応していない。貼られたトークンをそのまま使う
    }
  }
  const row = {
    provider,
    token_enc: encryptSecret(trimmed),
    account_id: account.accountId,
    account_name: account.username,
    expires_at: expiresAt,
    refreshed_at: now(),
    last_error: null,
    updated_at: now(),
  };
  const { error } = await getSupabase().from("integration_tokens").upsert(row, { onConflict: "provider" });
  if (error) throw new Error(`保存に失敗しました: ${error.message}（migration-014 を実行しましたか？）`);
  return {
    provider,
    connected: true,
    accountId: account.accountId,
    accountName: account.username,
    expiresAt: row.expires_at,
    refreshedAt: row.refreshed_at,
    lastError: null,
    exchanged,
  };
}

export async function deleteIntegrationToken(provider: IntegrationProvider): Promise<void> {
  const { error } = await getSupabase().from("integration_tokens").delete().eq("provider", provider);
  if (error) throw new Error(error.message);
}

/**
 * 使えるトークンを返す。前回の更新から日がたっていれば先に更新する。
 * 更新に失敗しても、期限内なら今のトークンをそのまま使う。
 */
export async function getUsableToken(provider: IntegrationProvider, { forceRefresh = false } = {}): Promise<{ token: string; refreshed: boolean }> {
  const row = await getIntegrationRow(provider);
  if (!row) throw new Error(`${provider === "instagram" ? "Instagram" : "Threads"} が連携されていません。SNS 投稿の「連携設定」でトークンを登録してください`);
  const token = decryptSecret(row.token_enc);
  const ageDays = row.refreshed_at ? (Date.now() - new Date(row.refreshed_at).getTime()) / 86400000 : Infinity;
  const expired = row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false;
  if (expired) throw new Error("トークンの期限が切れています。連携設定でトークンを入れ直してください");
  if (!forceRefresh && ageDays < REFRESH_AFTER_DAYS) return { token, refreshed: false };
  if (ageDays < 1 && !forceRefresh) return { token, refreshed: false }; // 発行から 24 時間は更新できない
  try {
    const next = await refreshToken(provider, token);
    await getSupabase()
      .from("integration_tokens")
      .update({
        token_enc: encryptSecret(next.token),
        expires_at: new Date(Date.now() + next.expiresIn * 1000).toISOString(),
        refreshed_at: now(),
        last_error: null,
        updated_at: now(),
      })
      .eq("provider", provider);
    return { token: next.token, refreshed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await getSupabase().from("integration_tokens").update({ last_error: `更新に失敗: ${message}`, updated_at: now() }).eq("provider", provider);
    if (forceRefresh) throw new Error(`トークンの更新に失敗しました: ${message}`);
    return { token, refreshed: false };
  }
}

/** 定期実行（cron）用: すべての連携のトークンを必要なら更新する */
export async function refreshAllTokens(): Promise<Array<{ provider: IntegrationProvider; result: string }>> {
  const out: Array<{ provider: IntegrationProvider; result: string }> = [];
  for (const provider of INTEGRATION_PROVIDERS) {
    const row = await getIntegrationRow(provider);
    if (!row) continue;
    try {
      const r = await getUsableToken(provider);
      out.push({ provider, result: r.refreshed ? "更新した" : "更新不要" });
    } catch (err) {
      out.push({ provider, result: `失敗: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  return out;
}
