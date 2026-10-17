import storesJson from "../../../data/stores.json";
import type { Store } from "../types";

const stores = storesJson as Store[];

export function getAllStores(): Store[] {
  return stores;
}

export function getStoreById(id: string | null | undefined): Store | undefined {
  if (!id) return undefined;
  return stores.find((s) => s.id === id);
}
