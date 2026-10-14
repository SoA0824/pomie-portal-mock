/**
 * Claude API の呼び出し（サーバー側の自動実行用）。
 *
 * Claude Code から使うときは Claude Code 自身が書くのでこのファイルは使わない。
 * GitHub Actions など、無人で動かすときだけ ANTHROPIC_API_KEY が必要。
 *
 * - 既定モデル: claude-opus-5-5（ARTICLE_MODEL で変更可）
 * - 長い出力になるためストリーミングで受け取り、finalMessage() で完成した本文を取る
 * - 安全分類での拒否時はサーバー側フォールバック（fallbacks: "default"）で別モデルに切り替える
 * - ARTICLE_WRITER=mock のときは API を呼ばず、呼び出し側が渡した mock() の結果を返す（テスト用）
 */

export const MODEL = process.env.ARTICLE_MODEL || "claude-opus-5-5";
export const EFFORT = process.env.ARTICLE_EFFORT || "high";

export function claudeAvailable() {
  return process.env.ARTICLE_WRITER === "mock" || Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// SDK は実際に API を呼ぶときだけ読み込む（コネクタ経路や status では不要なため）
let Anthropic;
let client;
async function getClient() {
  if (!client) {
    try {
      ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
    } catch {
      throw new Error("@anthropic-ai/sdk が見つかりません。プロジェクト直下で npm install を実行してください");
    }
    client = new Anthropic();
  }
  return client;
}

/**
 * 本文テキストを生成する。
 *   - user を渡すと 1 往復（system + user）
 *   - messages を渡すと会話形式（書き直し依頼など。最後は user のメッセージにすること）
 * 戻り値: { text, model, usage: { input, output, cacheRead } }
 */
export async function generateText({ system, user, messages, maxTokens = 32000, mock }) {
  if (process.env.ARTICLE_WRITER === "mock") {
    if (typeof mock !== "function") throw new Error("ARTICLE_WRITER=mock には mock() が必要です");
    return { text: mock(), model: "mock", usage: { input: 0, output: 0, cacheRead: 0 } };
  }
  const conversation = messages ?? [{ role: "user", content: user }];
  if (!conversation.length || conversation[conversation.length - 1].role !== "user") {
    throw new Error("messages の最後は user のメッセージにしてください");
  }

  const api = await getClient();
  const request = () =>
    api.beta.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      // 拒否されたときは別モデルにサーバー側で切り替える
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      // ガイドライン（固定部分）はキャッシュして 2 回目以降の入力コストを下げる
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: conversation,
    });

  let message;
  for (let attempt = 0; ; attempt++) {
    try {
      message = await request().finalMessage();
      break;
    } catch (err) {
      const retryable =
        err instanceof Anthropic.RateLimitError ||
        err instanceof Anthropic.APIConnectionError ||
        (err instanceof Anthropic.APIError && err.status !== undefined && err.status >= 500);
      if (err instanceof Anthropic.AuthenticationError) {
        throw new Error("Claude API の認証に失敗しました（ANTHROPIC_API_KEY を確認）");
      }
      if (!retryable || attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 20000 * (attempt + 1)));
    }
  }

  if (message.stop_reason === "refusal") {
    const detail = message.stop_details?.explanation ?? message.stop_details?.category ?? "";
    throw new Error(`生成が拒否されました${detail ? `: ${detail}` : ""}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("出力が上限に達して途中で切れました（max_tokens を増やしてください）");
  }

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    text,
    model: message.model,
    usage: {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/** 本文の前後に付くコードフェンスや説明を取り除く */
export function stripFences(text) {
  let t = text.trim();
  const m = t.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/);
  if (m) t = m[1].trim();
  // 先頭が --- でなければ、最初の --- 以降を本体とみなす
  const idx = t.indexOf("---");
  if (idx > 0 && !t.startsWith("---")) t = t.slice(idx);
  return t;
}

/** 応答から JSON（配列またはオブジェクト）を取り出す */
export function extractJson(text) {
  const t = stripFences(text);
  const start = Math.min(...["[", "{"].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c))));
  if (!Number.isFinite(start)) throw new Error("応答に JSON が見つかりません");
  const end = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  return JSON.parse(t.slice(start, end + 1));
}
