/**
 * Meta の投稿 API（Instagram API with Instagram Login / Threads API）。
 *
 * どちらも流れは同じ:
 *   ① 画像ごとに「コンテナ」を作る → ② カルーセルのコンテナにまとめる → ③ 処理完了を待つ → ④ 公開する
 * 画像は公開 URL の JPEG（Storage の書き出し画像をそのまま渡す）。
 *
 * テスト用に INSTAGRAM_GRAPH_BASE / THREADS_GRAPH_BASE で接続先を差し替えられる。
 */
import type { IntegrationProvider } from "@/lib/types";

const IG_BASE = (process.env.INSTAGRAM_GRAPH_BASE ?? "https://graph.instagram.com").replace(/\/$/, "");
const IG_VERSION = process.env.INSTAGRAM_GRAPH_VERSION ?? "v22.0";
const TH_BASE = (process.env.THREADS_GRAPH_BASE ?? "https://graph.threads.net").replace(/\/$/, "");
const TH_VERSION = process.env.THREADS_GRAPH_VERSION ?? "v1.0";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 45000;

type Json = Record<string, unknown>;

function baseOf(provider: IntegrationProvider) {
  return provider === "instagram" ? `${IG_BASE}/${IG_VERSION}` : `${TH_BASE}/${TH_VERSION}`;
}

function errorMessage(data: Json | null, status: number): string {
  const err = (data?.error ?? null) as Json | null;
  const msg = (err?.error_user_msg as string) || (err?.message as string) || JSON.stringify(data ?? {}).slice(0, 200);
  const code = err?.code !== undefined ? `（code ${err.code}）` : "";
  const hint =
    status === 401 || err?.code === 190
      ? " トークンが無効か期限切れです。連携設定でトークンを入れ直してください。"
      : err?.code === 10 || err?.code === 200
        ? " 権限が足りません。アプリに content_publish の権限があるか、アカウントがテスターとして追加されているか確認してください。"
        : "";
  return `${msg}${code}${hint}`;
}

async function call(method: "GET" | "POST", url: string, params: Record<string, string | undefined>): Promise<Json> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") body.set(k, v);
  const res = await fetch(method === "GET" ? `${url}?${body.toString()}` : url, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: method === "POST" ? body.toString() : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as Json | null;
  if (!res.ok || !data || data.error) throw new Error(errorMessage(data, res.status));
  return data;
}

/** トークンが使えるか確認し、アカウント情報を返す */
export async function verifyToken(provider: IntegrationProvider, token: string): Promise<{ accountId: string; username: string }> {
  const fields = provider === "instagram" ? "user_id,username" : "id,username";
  const me = await call("GET", `${baseOf(provider)}/me`, { fields, access_token: token });
  const accountId = String((provider === "instagram" ? me.user_id ?? me.id : me.id) ?? "");
  if (!accountId) throw new Error("アカウント情報を取得できませんでした（Instagram ログイン方式のトークンか確認してください）");
  return { accountId, username: String(me.username ?? "") };
}

/**
 * 短期トークン（数時間）を長期トークン（60 日）に交換する。アプリシークレットが必要。
 * すでに長期トークンのときはエラーになるので、呼び出し側で握りつぶしてよい。
 */
export async function exchangeToken(provider: IntegrationProvider, token: string, appSecret: string): Promise<{ token: string; expiresIn: number }> {
  const url = provider === "instagram" ? `${IG_BASE}/access_token` : `${TH_BASE}/access_token`;
  const data = await call("GET", url, {
    grant_type: provider === "instagram" ? "ig_exchange_token" : "th_exchange_token",
    client_secret: appSecret,
    access_token: token,
  });
  if (!data.access_token) throw new Error("長期トークンが返ってきませんでした");
  return { token: String(data.access_token), expiresIn: Number(data.expires_in ?? 60 * 24 * 3600) };
}

/** 長期トークンを更新する（発行から 24 時間以上たっていて、期限切れでないもの） */
export async function refreshToken(provider: IntegrationProvider, token: string): Promise<{ token: string; expiresIn: number }> {
  const url = provider === "instagram" ? `${IG_BASE}/refresh_access_token` : `${TH_BASE}/refresh_access_token`;
  const data = await call("GET", url, { grant_type: provider === "instagram" ? "ig_refresh_token" : "th_refresh_token", access_token: token });
  if (!data.access_token) throw new Error("更新後のトークンが返ってきませんでした");
  return { token: String(data.access_token), expiresIn: Number(data.expires_in ?? 60 * 24 * 3600) };
}

async function waitUntilFinished(provider: IntegrationProvider, containerId: string, token: string) {
  const statusField = provider === "instagram" ? "status_code,status" : "status,error_message";
  const started = Date.now();
  for (;;) {
    const data = await call("GET", `${baseOf(provider)}/${containerId}`, { fields: statusField, access_token: token });
    const status = String(provider === "instagram" ? data.status_code ?? data.status : data.status ?? "");
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`画像の処理に失敗しました（${status}）${data.error_message ? `: ${data.error_message}` : ""}`);
    }
    if (Date.now() - started > POLL_TIMEOUT_MS) throw new Error("画像の処理が時間内に終わりませんでした。少し待ってからもう一度お試しください");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function permalinkOf(provider: IntegrationProvider, mediaId: string, token: string): Promise<string | null> {
  try {
    const data = await call("GET", `${baseOf(provider)}/${mediaId}`, { fields: "permalink", access_token: token });
    return data.permalink ? String(data.permalink) : null;
  } catch {
    return null;
  }
}

export type PublishResult = { mediaId: string; permalink: string | null };

/**
 * Instagram にフィード投稿する（画像 1 枚 or カルーセル 2〜10 枚）。
 */
export async function publishInstagram(input: { token: string; imageUrls: string[]; caption: string; altText?: string | null }): Promise<PublishResult> {
  const { token, imageUrls, caption } = input;
  if (imageUrls.length === 0) throw new Error("投稿する画像がありません");
  if (imageUrls.length > 10) throw new Error("Instagram の API で投稿できるのは 10 枚までです（枚数を減らしてください）");
  const base = baseOf("instagram");

  const createItem = async (imageUrl: string, extra: Record<string, string | undefined>) => {
    try {
      return await call("POST", `${base}/me/media`, { image_url: imageUrl, access_token: token, ...extra });
    } catch (err) {
      // alt_text に未対応のアカウント・バージョンでは外して再試行
      if (extra.alt_text && /alt_text|Invalid parameter/i.test(String(err))) {
        return call("POST", `${base}/me/media`, { image_url: imageUrl, access_token: token, ...extra, alt_text: undefined });
      }
      throw err;
    }
  };

  let creationId: string;
  if (imageUrls.length === 1) {
    const c = await createItem(imageUrls[0], { caption, alt_text: input.altText ?? undefined });
    creationId = String(c.id);
  } else {
    const children: string[] = [];
    for (const [i, url] of imageUrls.entries()) {
      const c = await createItem(url, { is_carousel_item: "true", alt_text: i === 0 ? input.altText ?? undefined : undefined });
      children.push(String(c.id));
    }
    const carousel = await call("POST", `${base}/me/media`, { media_type: "CAROUSEL", children: children.join(","), caption, access_token: token });
    creationId = String(carousel.id);
  }
  await waitUntilFinished("instagram", creationId, token);
  const published = await call("POST", `${base}/me/media_publish`, { creation_id: creationId, access_token: token });
  const mediaId = String(published.id);
  return { mediaId, permalink: await permalinkOf("instagram", mediaId, token) };
}

/**
 * Threads に投稿する（本文 + 画像 0〜20 枚。本文のリンクは押せる）。
 */
export async function publishThreads(input: { token: string; imageUrls: string[]; text: string }): Promise<PublishResult> {
  const { token, imageUrls, text } = input;
  if (imageUrls.length > 20) throw new Error("Threads に投稿できる画像は 20 枚までです");
  const base = baseOf("threads");

  let creationId: string;
  if (imageUrls.length === 0) {
    const c = await call("POST", `${base}/me/threads`, { media_type: "TEXT", text, access_token: token });
    creationId = String(c.id);
  } else if (imageUrls.length === 1) {
    const c = await call("POST", `${base}/me/threads`, { media_type: "IMAGE", image_url: imageUrls[0], text, access_token: token });
    creationId = String(c.id);
  } else {
    const children: string[] = [];
    for (const url of imageUrls) {
      const c = await call("POST", `${base}/me/threads`, { media_type: "IMAGE", image_url: url, is_carousel_item: "true", access_token: token });
      children.push(String(c.id));
    }
    const carousel = await call("POST", `${base}/me/threads`, { media_type: "CAROUSEL", children: children.join(","), text, access_token: token });
    creationId = String(carousel.id);
  }
  await waitUntilFinished("threads", creationId, token);
  const published = await call("POST", `${base}/me/threads_publish`, { creation_id: creationId, access_token: token });
  const mediaId = String(published.id);
  return { mediaId, permalink: await permalinkOf("threads", mediaId, token) };
}
