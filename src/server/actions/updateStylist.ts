"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { getStoreById } from "@/lib/data/stores";
import { generateDummyAvailableSlots } from "@/lib/generateDummySlots";
import type { UpdateStylistInput, Stylist } from "@/lib/types";
import { syncInstagramPosts } from "./syncInstagramPosts";

export type UpdateStylistResult =
  | { ok: true; stylist: Stylist; instagramHandleChanged: boolean }
  | { ok: false; reason: string; field?: string };

function normalizeHandle(raw?: string): string | null {
  if (!raw) return null;
  let h = raw.trim();
  if (!h) return null;
  if (h.startsWith("@")) h = h.slice(1);
  const m = h.match(/instagram\.com\/([^/?#]+)/i);
  if (m) h = m[1];
  h = h.replace(/\/$/, "");
  return h || null;
}

export async function updateStylist(
  input: UpdateStylistInput
): Promise<UpdateStylistResult> {
  // ===== バリデーション =====
  if (!input.id?.trim()) return { ok: false, reason: "missing_id" };
  if (!input.name?.trim()) return { ok: false, reason: "missing_name", field: "name" };
  if (!input.storeId?.trim())
    return { ok: false, reason: "missing_store", field: "storeId" };
  if (!input.profile?.trim())
    return { ok: false, reason: "missing_profile", field: "profile" };
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

  // ===== 既存レコード取得（前後比較に使用）=====
  const sb = getSupabase();
  const { data: existing, error: fetchError } = await sb
    .from("stylists")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (fetchError) return { ok: false, reason: fetchError.message };
  if (!existing) return { ok: false, reason: "stylist_not_found" };

  // ===== アバター補完: 空欄なら IG / picsum へ =====
  let avatar = input.avatar?.trim() || "";
  if (!avatar && handle) {
    avatar = `https://unavatar.io/instagram/${handle}`;
  }
  if (!avatar) {
    avatar = `https://picsum.photos/seed/${encodeURIComponent(input.name)}/300/300`;
  }

  const snsLinks: Record<string, string> = { ...(existing.sns_links ?? {}) };
  if (handle) {
    snsLinks.instagram = `https://www.instagram.com/${handle}/`;
  } else {
    delete snsLinks.instagram;
  }

  // ===== スロット解決 =====
  // 1) 入力で明示的に指定されたら必ず使う（空配列なら空のまま）
  // 2) 未指定（undefined）なら、未来枠が無い場合のみ自動補完
  let refreshedSlots: string[];
  if (Array.isArray(input.availableTimeSlots)) {
    refreshedSlots = input.availableTimeSlots;
  } else {
    const currentSlots: string[] = existing.available_time_slots ?? [];
    const todayIso = new Date().toISOString().slice(0, 10);
    const hasFutureSlot = currentSlots.some((s) => s.slice(0, 10) >= todayIso);
    refreshedSlots = hasFutureSlot
      ? currentSlots
      : generateDummyAvailableSlots(input.id, 8);
  }

  // ===== UPDATE =====
  const { data, error: updateError } = await sb
    .from("stylists")
    .update({
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
      available_time_slots: refreshedSlots,
      instagram_handle: handle,
      sns_links: snsLinks,
      contract_status: input.contractStatus,
      featured_flag: input.featuredFlag,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select()
    .single();

  if (updateError || !data) {
    return { ok: false, reason: updateError?.message ?? "update_failed" };
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
    availableTimeSlots: data.available_time_slots ?? [],
    instagramHandle: data.instagram_handle,
    snsLinks: data.sns_links,
    contractStatus: data.contract_status,
    featuredFlag: data.featured_flag,
    rating: Number(data.rating),
    worksCount: data.works_count,
    instagramSyncedAt: data.instagram_synced_at,
  };

  // ===== IG ハンドルが変わったら投稿を再同期 =====
  const handleChanged = (existing.instagram_handle ?? null) !== (handle ?? null);
  if (handleChanged && handle) {
    await syncInstagramPosts(input.id);
  }

  revalidatePath("/admin/stylists");
  revalidatePath(`/admin/stylists/${input.id}/edit`);
  revalidatePath(`/stylists/${input.id}`);
  revalidatePath("/stylists");
  revalidatePath("/");

  return { ok: true, stylist, instagramHandleChanged: handleChanged };
}
