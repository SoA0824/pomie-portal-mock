"use server";

import { revalidatePath } from "next/cache";
import { deleteIntegrationToken, getUsableToken, saveIntegrationToken } from "@/lib/integrations/tokens";
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from "@/lib/types";

type Result = { ok: true; message?: string } | { ok: false; reason: string };

function valid(provider: string): provider is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(provider);
}

/** トークンを確認して保存する */
export async function connectIntegration(provider: IntegrationProvider, token: string): Promise<Result> {
  if (!valid(provider)) return { ok: false, reason: "連携先が不正です" };
  try {
    const s = await saveIntegrationToken(provider, token);
    revalidatePath("/admin/social/settings");
    return {
      ok: true,
      message: `@${s.accountName || s.accountId} として接続しました${s.exchanged ? "（長期トークンに変換しました）" : ""}`,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function disconnectIntegration(provider: IntegrationProvider): Promise<Result> {
  if (!valid(provider)) return { ok: false, reason: "連携先が不正です" };
  try {
    await deleteIntegrationToken(provider);
    revalidatePath("/admin/social/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** いますぐトークンを更新する（期限を延ばす） */
export async function refreshIntegration(provider: IntegrationProvider): Promise<Result> {
  if (!valid(provider)) return { ok: false, reason: "連携先が不正です" };
  try {
    const r = await getUsableToken(provider, { forceRefresh: true });
    revalidatePath("/admin/social/settings");
    return { ok: true, message: r.refreshed ? "トークンを更新しました（期限が 60 日延びました）" : "更新は不要でした" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
