import stylistsJson from "../../../data/stylists.json";
import type { Stylist } from "../types";

const stylists = stylistsJson as Stylist[];

export type StylistFilter = {
  menu?: string;
  storeId?: string;
  hasSns?: boolean;
  minRating?: number;
  keyword?: string;
};

export type StylistSort = "recommended" | "rating" | "works";

export function getAllPublishedStylists(): Stylist[] {
  return stylists.filter((s) => s.contractStatus === "active");
}

export function getStylistById(id: string): Stylist | undefined {
  const s = stylists.find((s) => s.id === id);
  if (!s || s.contractStatus !== "active") return undefined;
  return s;
}

export function getStylistByIdIncludingInactive(id: string): Stylist | undefined {
  return stylists.find((s) => s.id === id);
}

export function getFeaturedStylists(limit = 4): Stylist[] {
  return getAllPublishedStylists()
    .filter((s) => s.featuredFlag)
    .slice(0, limit);
}

export function searchStylists(filter: StylistFilter, sort: StylistSort = "recommended"): Stylist[] {
  let list = getAllPublishedStylists();

  if (filter.menu) {
    list = list.filter((s) => s.menus.includes(filter.menu!));
  }
  if (filter.storeId) {
    list = list.filter((s) => s.storeId === filter.storeId);
  }
  if (filter.hasSns) {
    list = list.filter((s) => Object.keys(s.snsLinks).length > 0);
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
        s.menus.some((m) => m.toLowerCase().includes(k))
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

export function listAllMenus(): string[] {
  const set = new Set<string>();
  for (const s of getAllPublishedStylists()) for (const m of s.menus) set.add(m);
  return Array.from(set).sort();
}
