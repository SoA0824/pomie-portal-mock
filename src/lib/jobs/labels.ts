import type { JobKind, JobStatus } from "@/lib/types";

export const JOB_KIND_LABEL: Record<JobKind, string> = {
  propose: "キーワード候補の提案",
  write: "記事の執筆",
  rewrite: "リライト案の作成",
  social: "SNS 投稿の作成",
  social_images: "SNS 画像の作り直し",
};

export const JOB_STATUS_LABEL: Record<JobStatus, { label: string; className: string }> = {
  queued: { label: "実行待ち", className: "bg-amber-100 text-amber-800" },
  running: { label: "実行中", className: "bg-pomie-100 text-pomie-700" },
  done: { label: "完了", className: "bg-green-100 text-green-800" },
  failed: { label: "失敗", className: "bg-red-100 text-red-700" },
  canceled: { label: "取り消し", className: "bg-ink-100 text-ink-500" },
};
