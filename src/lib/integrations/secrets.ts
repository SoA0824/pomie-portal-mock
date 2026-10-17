import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * 連携のトークンを DB に置くための暗号化（AES-256-GCM）。
 * 鍵は Vercel の環境変数 INTEGRATION_SECRET（サーバーだけが知っている）。
 * DB は匿名キーで読めるが、この鍵が無いと復号できない。
 */
const PREFIX = "v1";

function key(): Buffer {
  const secret = process.env.INTEGRATION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("INTEGRATION_SECRET が未設定です。Vercel の Environment Variables に 32 文字以上のランダムな文字列を設定してください");
  }
  return createHash("sha256").update(secret).digest();
}

export function integrationSecretConfigured(): boolean {
  const s = process.env.INTEGRATION_SECRET;
  return Boolean(s && s.length >= 16);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [prefix, ivB64, tagB64, encB64] = stored.split(":");
  if (prefix !== PREFIX || !ivB64 || !tagB64 || !encB64) throw new Error("保存されているトークンの形式が不正です");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
}
