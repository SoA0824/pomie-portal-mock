"use client";

import { useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

const BUCKET = "stylist-images";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

/**
 * 画像アップロード + URL 手入力の両対応フィールド。
 *
 * - ファイルを選ぶと Supabase Storage にアップロードし、公開 URL を value にセット
 * - 10MB 超・非対応形式はアップロード前に弾く
 * - 既存の URL 貼り付け運用も引き続き可能
 */
export function ImageUploadField({
  value,
  onChange,
  folder,
  previewShape = "square",
}: {
  value: string;
  onChange: (url: string) => void;
  /** Storage 内のフォルダ名（例: "avatars" / "backgrounds"） */
  folder: string;
  previewShape?: "square" | "wide";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("JPEG / PNG / WebP / GIF の画像を選んでください");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `ファイルサイズが大きすぎます（${formatBytes(file.size)}）。10MB 以下にしてください`
      );
      return;
    }

    setUploading(true);
    try {
      const sb = getSupabase();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${folder}/${Date.now()}-${rand}.${ext}`;

      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
      setError(
        msg.includes("Bucket not found")
          ? "画像保管庫が未作成です。Supabase で migration-007 を実行してください"
          : `アップロードに失敗しました: ${msg}`
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {/* プレビュー */}
      {value && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="プレビュー"
            className={
              previewShape === "wide"
                ? "h-24 w-44 rounded-lg object-cover ring-1 ring-ink-100"
                : "h-24 w-24 rounded-lg object-cover ring-1 ring-ink-100"
            }
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-ink-500 hover:text-red-600"
          >
            画像を削除
          </button>
        </div>
      )}

      {/* アップロードボタン */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-pomie-500 px-4 py-1.5 text-xs font-semibold text-pomie-600 transition hover:bg-pomie-100 disabled:opacity-60"
        >
          {uploading ? "アップロード中..." : value ? "画像を変更" : "＋ 画像をアップロード"}
        </button>
        <span className="text-[11px] text-ink-500">JPEG / PNG / WebP / GIF ・ 10MB 以下</span>
      </div>

      {/* URL 手入力（従来通り） */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="または画像 URL を直接貼り付け"
        className="input"
      />

      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
