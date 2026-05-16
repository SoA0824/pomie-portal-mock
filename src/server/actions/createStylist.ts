"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { getStoreById } from "@/lib/data/stores";
import { generateDummyAvailableSlots } from "@/lib/generateDummySlots";
import type { CreateStylistInput, Stylist } from "@/lib/types";
import { syncInstagramPosts } from "./syncInstagramPosts";

export type CreateStylistResult =
  | { ok: true; stylist: Stylist; syncedPostsCount?: number }
  | { ok: false; reason: string; field?: string };

function generateStylistId(): string {
  // 6 文字のランダムな英数字（小文字 + 数字）
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `st-${s}`;
}

function normalizeHandle(raw?: string): string | null {
  if (!raw) return null;
  // 余計な記号を除去: @ や URL、末尾スラッシュ
  let h = raw.trim();
  if (!h) return null;
  if (h.startsWith("@")) h = h.slice(1);
  const m = h.match(/instagram\.com\/([^/?#]+)/i);
  if (m) h = m[1];
  h = h.replace(/\/$/, "");
  return h || null;
}

export async function createStylist(
  input: CreateStylistInput
): Promise<CreateStylistResult> {
  // ===== バリデーション =====
  if (!input.name?.trim()) return { ok: false, reason: "missing_name", field: "name" };
  if (!input.storeId?.trim()) return { ok: false, reason: "missing_store", field: "storeId" };
  if (!input.profile?.trim()) return { ok: false, reason: "missing_profile", field: "profile" };
  if (!input.menus || input.menus.length === 0)
    return { ok: false, reason: "missing_menus", field: "menus" };
  if (input.menus.some((m) => !m.name?.trim() || !m.duration || m.duration <= 0)) {
    return { ok: false, reason: "invalid_menus", field: "menus" };
  }
  if (
    !input.priceRange ||
    typeof input.priceRange.min !== "number" ||
    typeof input.priceRange.max !== "number" ||
    input.priceRange.min < 0 ||
    input.priceRange.max < input.priceRange.min
  ) {
    return { ok: false, reason: "invalid_price_range", field: "priceRange" };
  }

  const handle = normalizeHandle(input.instagramHandle);

  // ===== エリアは店舗から自動派生 =====
  const store = getStoreById(input.storeId);
  if (!store) return { ok: false, reason: "invalid_store", field: "storeId" };
  const area = store.area;

  // ===== アバター補完 =====
  let avatar = input.avatar?.trim() || "";
  if (!avatar && handle) {
    avatar = `https://unavatar.io/instagram/${handle}`;
  }
  if (!avatar) {
    // 最終フォールバック
    avatar = `https://picsum.photos/seed/${encodeURIComponent(input.name)}/300/300`;
  }

  // ===== INSERT =====
  const id = generateStylistId();
  const snsLinks: Record<string, string> = {};
  if (handle) snsLinks.instagram = `https://www.instagram.com/${handle}/`;

  const sb = getSupabase();
  const { data, error } = await sb
    .from("stylists")
    .insert({
      id,
      name: input.name.trim(),
      name_kana: input.nameKana?.trim() || null,
      avatar,
      profile: input.profile.trim(),
      store_id: input.storeId,
      area,
      strengths: (input.strengths ?? []).map((s) => s.trim()).filter(Boolean),
      specialty_menus: (input.specialtyMenus ?? []).map((s) => s.trim()).filter(Boolean),
      menus: input.menus.map((m) => ({ name: m.name.trim(), duration: m.duration })),
      price_range: input.priceRange,
      available_time_slots:
        input.availableTimeSlots && input.availableTimeSlots.length > 0
          ? input.availableTimeSlots
          : generateDummyAvailableSlots(id, 8),
      instagram_handle: handle,
      sns_links: snsLinks,
      contract_status: input.contractStatus,
      featured_flag: input.featuredFlag,
      rating: 0,
      works_count: 0,
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, reason: error?.message ?? "insert_failed" };
  }

  const stylist: Stylist = {
    id: data.id,
    name: data.name,
    nameKana: data.name_kana ?? "",
    avatar: data.avatar ?? "",
    profile: data.profile,
    storeId: data.store_id,
    area: data.area ?? "",
    strengths: data.strengths ?? [],
    specialtyMenus: data.specialty_menus ?? [],
    menus: data.menus ?? [],
    priceRange: data.price_range,
    availableTimeSlots: [],
    instagramHandle: data.instagram_handle,
    snsLinks,
    contractStatus: data.contract_status,
    featuredFlag: data.featured_flag,
    rating: Number(data.rating),
    worksCount: data.works_count,
    instagramSyncedAt: null,
  };

  // ===== 初回 Instagram 同期（任意・失敗しても登録自体は成功扱い） =====
  let syncedPostsCount: number | undefined;
  if (handle) {
    const result = await syncInstagramPosts(id);
    if (result.ok) {
      syncedPostsCount = result.count;
    }
    // 失敗は無視（管理画面で個別に再試行可能）
  }

  revalidatePath("/admin/stylists");
  revalidatePath("/stylists");
  revalidatePath("/");

  return { ok: true, stylist, syncedPostsCount };
}
