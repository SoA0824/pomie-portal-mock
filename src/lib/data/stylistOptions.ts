import { getAllStylistsIncludingInactive } from "./stylists";
import { getStoreById } from "./stores";
import type { StylistOption } from "@/components/admin/ArticleForm";

/** 記事フォームの「紹介する美容師」の選択肢 */
export async function getStylistOptions(): Promise<StylistOption[]> {
  const stylists = await getAllStylistsIncludingInactive();
  return stylists
    .map((s) => ({
      id: s.id,
      name: s.name,
      storeName: getStoreById(s.storeId)?.name ?? "",
      active: s.contractStatus === "active",
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "ja"));
}
