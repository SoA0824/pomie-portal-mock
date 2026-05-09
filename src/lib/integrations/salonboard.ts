import type { SalonboardClient } from "../types";
import { createSalonboardMock } from "./salonboard.mock";

let cached: SalonboardClient | undefined;

export function getSalonboardClient(): SalonboardClient {
  if (cached) return cached;
  const driver = process.env.SALONBOARD_DRIVER ?? "mock";
  switch (driver) {
    case "mock":
    default:
      cached = createSalonboardMock();
      break;
    // 'csv' / 'rpa' / 'api' は将来の正式実装で差し替える
  }
  return cached;
}
