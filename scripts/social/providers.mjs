/**
 * 画像生成 API（差し替え可能）。
 *   gemini … Google AI Studio の API キー（GEMINI_API_KEY）。推奨。縦長 4:5 に対応、参照画像を渡せる
 *   openai … OpenAI の API キー（OPENAI_API_KEY）。縦長は 2:3 で生成し、テンプレート側で切り抜く
 *
 * どちらも REST で呼ぶ（追加ライブラリ不要）。モデル名は環境変数で上書きできる。
 */
import { fetchBytes, loadSecret } from "./lib.mjs";

/** すべての指示に付ける（文字・顔を描かせない） */
export const PROMPT_SUFFIX =
  "No text, letters, numbers, logos, signage or watermarks anywhere in the image. No recognizable human faces. Soft natural light, warm beige and brown tones, calm and clean, editorial photography style.";

export const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash-image",
  openai: "gpt-image-1",
};

export function pickProvider(explicit) {
  const p = explicit || loadSecret("SOCIAL_IMAGE_PROVIDER");
  if (p) {
    if (!["gemini", "openai"].includes(p)) throw new Error(`画像 API は gemini か openai を指定してください（指定値: ${p}）`);
    return p;
  }
  if (loadSecret("GEMINI_API_KEY")) return "gemini";
  if (loadSecret("OPENAI_API_KEY")) return "openai";
  throw new Error(
    "画像 API のキーがありません。.env.production.local に GEMINI_API_KEY（https://aistudio.google.com で発行）を追加してください（OpenAI なら OPENAI_API_KEY）。"
  );
}

export function modelFor(provider) {
  return loadSecret(provider === "gemini" ? "GEMINI_IMAGE_MODEL" : "OPENAI_IMAGE_MODEL") || DEFAULT_MODELS[provider];
}

/**
 * 画像を 1 枚作る。
 * @returns {{ bytes: Buffer, mime: string, provider: string, model: string }}
 */
export async function generateImage({ provider, prompt, aspectRatio = "4:5", referenceImageUrls = [] }) {
  const fullPrompt = `${prompt.trim()}\n\n${PROMPT_SUFFIX}`;
  if (provider === "gemini") return generateWithGemini({ prompt: fullPrompt, aspectRatio, referenceImageUrls });
  if (provider === "openai") return generateWithOpenAI({ prompt: fullPrompt, aspectRatio });
  throw new Error(`未対応の画像 API: ${provider}`);
}

async function generateWithGemini({ prompt, aspectRatio, referenceImageUrls }) {
  const key = loadSecret("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY が設定されていません（.env.production.local）");
  const model = modelFor("gemini");
  const base = (loadSecret("GEMINI_API_BASE") || "https://generativelanguage.googleapis.com").replace(/\/$/, "");

  const parts = [];
  for (const url of referenceImageUrls.slice(0, 2)) {
    const { bytes, mime } = await fetchBytes(url);
    parts.push({ inline_data: { mime_type: mime, data: bytes.toString("base64") } });
  }
  if (referenceImageUrls.length) parts.push({ text: "Use the attached photo(s) only as a reference for mood, colors and materials. Do not copy them." });
  parts.push({ text: prompt });

  const res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data).slice(0, 300);
    const hint =
      res.status === 429 ? "（上限に達しています。しばらく待つか、Google Cloud の課金設定を確認）" : res.status === 403 || res.status === 401 ? "（API キーを確認してください）" : "";
    throw new Error(`Gemini の画像生成に失敗しました（HTTP ${res.status}）: ${msg} ${hint}`);
  }
  const blocked = data?.promptFeedback?.blockReason;
  if (blocked) throw new Error(`Gemini が指示を拒否しました（${blocked}）。指示文を見直してください`);
  const cand = data?.candidates?.[0];
  const partsOut = cand?.content?.parts ?? [];
  const img = partsOut.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const text = partsOut.map((p) => p.text).filter(Boolean).join(" ").slice(0, 200);
    throw new Error(`Gemini が画像を返しませんでした（${cand?.finishReason ?? "理由不明"}）${text ? `: ${text}` : ""}`);
  }
  const inline = img.inlineData ?? img.inline_data;
  return { bytes: Buffer.from(inline.data, "base64"), mime: inline.mimeType ?? inline.mime_type ?? "image/png", provider: "gemini", model };
}

async function generateWithOpenAI({ prompt, aspectRatio }) {
  const key = loadSecret("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY が設定されていません（.env.production.local）");
  const model = modelFor("openai");
  const base = (loadSecret("OPENAI_API_BASE") || "https://api.openai.com").replace(/\/$/, "");
  const size = aspectRatio === "1:1" ? "1024x1024" : aspectRatio === "16:9" || aspectRatio === "3:2" ? "1536x1024" : "1024x1536";
  const res = await fetch(`${base}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, quality: loadSecret("OPENAI_IMAGE_QUALITY") || "medium", n: 1 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data).slice(0, 300);
    throw new Error(`OpenAI の画像生成に失敗しました（HTTP ${res.status}）: ${msg}`);
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI が画像を返しませんでした");
  return { bytes: Buffer.from(b64, "base64"), mime: "image/png", provider: "openai", model };
}
