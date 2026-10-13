/**
 * ラッコキーワード API クライアント（サーバー側の自動実行用）。
 *
 * Claude Code から使うときはコネクタ（MCP）があるのでこのファイルは使わない。
 * GitHub Actions など、コネクタが無い場所で動かすときだけ RAKKO_API_KEY が必要。
 *
 * 仕様: https://api.rakkokeyword.com/docs （認証は X-API-Key ヘッダー）
 * クレジット: suggest / question は 1 回あたり 1.5（ライトプランは 5）
 */

const BASE_URL = (process.env.RAKKO_API_BASE_URL || "https://api.rakkokeyword.com").replace(/\/$/, "");

export class RakkoError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "RakkoError";
    this.status = status;
  }
}

/** このプロセスで消費したクレジットの合計 */
export const usage = { credits: 0, requests: 0 };

export function rakkoAvailable() {
  return Boolean(process.env.RAKKO_API_KEY);
}

async function call(method, path, body) {
  const key = process.env.RAKKO_API_KEY;
  if (!key) throw new RakkoError("RAKKO_API_KEY が設定されていません", 0);

  const doFetch = () =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 429) {
    // レート制限（60 リクエスト / 60 秒）。少し待って 1 回だけやり直す
    await new Promise((r) => setTimeout(r, 15000));
    res = await doFetch();
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new RakkoError(`ラッコキーワード API の応答を読めません (HTTP ${res.status})`, res.status);
  }
  if (!res.ok || json.result === false) {
    const msg = (json.errors ?? []).join(" / ") || `HTTP ${res.status}`;
    if (res.status === 402) throw new RakkoError(`ラッコキーワードのクレジットが不足しています: ${msg}`, 402);
    if (res.status === 403) throw new RakkoError("ラッコキーワード API の認証に失敗しました（API キーを確認）", 403);
    throw new RakkoError(`ラッコキーワード API エラー: ${msg}`, res.status);
  }
  usage.credits += Number(json.meta?.consumedCredit ?? 0);
  usage.requests += 1;
  return json.data;
}

/** サジェストキーワード（検索数・難易度つき） */
export async function suggestKeywords({ keyword, limit = 40, modes = ["google"], filter } = {}) {
  const data = await call("POST", "/v1/suggest-keywords", {
    keyword,
    modes,
    limit,
    sortBy: "searchVolume",
    orderBy: "desc",
    ...(filter ? { filter } : {}),
  });
  return (data?.items ?? []).map(normalizeKeywordItem);
}

/** よくある質問（相対需要つき） */
export async function questionSearch({ keyword, limit = 20 } = {}) {
  const data = await call("POST", "/v1/question-search", { keyword, limit, sortBy: "relativeDemand", orderBy: "desc" });
  return (data?.items ?? []).map((it) => ({
    question: it.question,
    relativeDemand: it.metrics?.relativeDemand ?? null,
  }));
}

/** アカウント情報（クレジット残高）。クレジットは消費しない */
export async function accountInfo() {
  return call("GET", "/v1/account/info");
}

/** API / MCP の items を共通の形にそろえる */
export function normalizeKeywordItem(it) {
  const m = it.metrics ?? {};
  return {
    keyword: String(it.keyword ?? "").trim(),
    suggestClass: it.suggestClass ?? null,
    searchVolume: m.searchVolume ?? null,
    seoDifficulty: m.seoDifficulty ?? null,
    competition: m.competition ?? null,
    cpc: m.cpc ?? null,
    firstSeenRange: m.firstSeenRange ?? null,
  };
}
