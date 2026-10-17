import type { SocialPlatform, SocialPostStatus, SocialSlideKind, SocialTemplate } from "@/lib/types";

export const SOCIAL_STATUS_LABEL: Record<SocialPostStatus, { label: string; className: string }> = {
  requested: { label: "依頼済み（作成待ち）", className: "bg-amber-100 text-amber-800" },
  draft: { label: "下書き", className: "bg-ink-100 text-ink-700" },
  ready: { label: "書き出し済み（投稿できます）", className: "bg-pomie-100 text-pomie-700" },
  posted: { label: "投稿済み", className: "bg-green-100 text-green-800" },
  rejected: { label: "却下", className: "bg-ink-100 text-ink-500" },
  failed: { label: "失敗", className: "bg-red-100 text-red-700" },
};

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
};

export const TEMPLATE_LABEL: Record<SocialTemplate, string> = {
  photo: "写真＋文字",
  cream: "クリーム地",
};

export const SLIDE_KIND_LABEL: Record<SocialSlideKind, string> = {
  cover: "表紙",
  point: "ポイント",
  cta: "まとめ・導線",
};
