import type { Stylist, SnsPlatform, StylistMenu } from "../types";
import { getSupabase, type StylistRow } from "@/lib/supabase/client";

function rowToStylist(row: StylistRow): Stylist {
  const rawMenus = (row.menus ?? []) as unknown;
  // 旧形式 (text[]) と新形式 (jsonb [{name,duration}]) の両方を吸収
  let menus: StylistMenu[];
  if (Array.isArray(rawMenus) && rawMenus.length > 0 && typeof rawMenus[0] === "string") {
    menus = (rawMenus as string[]).map((name) => ({ name, duration: 60 }));
  } else {
    menus = (rawMenus as StylistMenu[]) ?? [];
  }
  return {
    id: row.id,
    name: row.name,
    nameKana: row.name_kana ?? "",
    avatar: row.avatar ?? "",
    profile: row.profile,
    storeId: row.store_id,
    area: row.area ?? "",
    strengths: row.strengths ?? [],
    specialtyMenus: row.specialty_menus ?? [],
    menus,
    priceRange: row.price_range,
    availableTimeSlots: row.available_time_slots ?? [],
    instagramHandle: row.instagram_handle,
    snsLinks: (row.sns_links ?? {}) as Partial<Record<SnsPlatform, string>>,
    contractStatus: row.contract_status,
    featuredFlag: row.featured_flag,
    rating: Number(row.rating),
    worksCount: row.works_count,
    instagramSyncedAt: row.instagram_synced_at,
  };
}

export type StylistFilter = {
  menu?: string;
  storeId?: string;
  hasSns?: boolean;
  minRating?: number;
  keyword?: string;
};

export type StylistSort = "recommended" | "rating" | "works";

async function fetchAll(): Promise<Stylist[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("stylists").select("*");
  if (error) throw new Error(`Failed to fetch stylists: ${error.message}`);
  return (data ?? []).map(rowToStylist);
}

export async function getAllStylistsIncludingInactive(): Promise<Stylist[]> {
  return fetchAll();
}

export async function getAllPublishedStylists(): Promise<Stylist[]> {
  const list = await fetchAll();
  return list.filter((s) => s.contractStatus === "active");
}

export async function getStylistById(id: string): Promise<Stylist | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb.from("stylists").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to fetch stylist: ${error.message}`);
  if (!data) return undefined;
  const stylist = rowToStylist(data);
  return stylist.contractStatus === "active" ? stylist : undefined;
}

export async function getStylistByIdIncludingInactive(id: string): Promise<Stylist | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb.from("stylists").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to fetch stylist: ${error.message}`);
  return data ? rowToStylist(data) : undefined;
}

export async function getFeaturedStylists(limit = 4): Promise<Stylist[]> {
  const list = await getAllPublishedStylists();
  return list.filter((s) => s.featuredFlag).slice(0, limit);
}

export async function searchStylists(
  filter: StylistFilter,
  sort: StylistSort = "recommended"
): Promise<Stylist[]> {
  let list = await getAllPublishedStylists();

  if (filter.menu) {
    list = list.filter((s) => s.menus.some((m) => m.name === filter.menu));
  }
  if (filter.storeId) {
    list = list.filter((s) => s.storeId === filter.storeId);
  }
  if (filter.hasSns) {
    list = list.filter((s) => Object.keys(s.snsLinks ?? {}).length > 0);
  }
  if (typeof filter.minRating === "number") {
    list = list.filter((s) => s.rating >= filter.minRating!);
  }
  if (filter.keyword) {
    const k = filter.keyword.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(k) ||
        s.nameKana.toLowerCase().includes(k) ||
        s.profile.toLowerCase().includes(k) ||
        s.strengths.some((x) => x.toLowerCase().includes(k)) ||
        s.specialtyMenus.some((x) => x.toLowerCase().includes(k)) ||
        s.menus.some((m) => m.name.toLowerCase().includes(k))
    );
  }

  switch (sort) {
    case "rating":
      list = [...list].sort((a, b) => b.rating - a.rating);
      break;
    case "works":
      list = [...list].sort((a, b) => b.worksCount - a.worksCount);
      break;
    case "recommended":
    default:
      list = [...list].sort((a, b) => {
        if (a.featuredFlag !== b.featuredFlag) return a.featuredFlag ? -1 : 1;
        return b.rating - a.rating;
      });
  }

  return list;
}

export async function listAllMenus(): Promise<string[]> {
  const list = await getAllPublishedStylists();
  const set = new Set<string>();
  for (const s of list) for (const m of s.menus) set.add(m.name);
  return Array.from(set).sort();
}
