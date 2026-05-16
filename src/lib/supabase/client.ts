import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | undefined;

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[POMiE] 環境変数 ${name} が未設定です。.env.local（ローカル）または Vercel の Environment Variables に設定してください。`
    );
  }
  return value;
}

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  // 書き込みも anon key で行う（RLS は無効化前提・MVP モック）。
  // 本番化時は server role key を使い、Server Action 限定で読み書きする構成へ。
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  cached = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      // Next.js のデータキャッシュを回避（管理画面が古い SELECT 結果を返すのを防ぐ）
      fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: "no-store" }),
    },
  });
  return cached;
}

export type ReservationRow = {
  id: string;
  customer_name: string;
  customer_contact: string;
  stylist_id: string;
  store_id: string;
  menus: string[];
  duration_minutes: number;
  desired_date_time: string;
  channel: "web" | "line";
  status: "confirmed" | "pending" | "rejected";
  salonboard_status: "reserved" | "unavailable" | "pending" | "failed";
  salonboard_booking_id: string | null;
  salonboard_synced_at: string | null;
  salonboard_error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type SalonboardBookingRow = {
  booking_id: string;
  shop_id: string;
  date_time: string;
  stylist_name: string;
  customer_name: string;
  customer_contact: string;
  menu: string;
  created_at: string;
};

export type StylistRow = {
  id: string;
  name: string;
  name_kana: string | null;
  avatar: string | null;
  profile: string;
  store_id: string;
  area: string | null;
  menus: Array<{ name: string; duration: number }>;
  price_range: { min: number; max: number };
  available_time_slots: string[];
  instagram_handle: string | null;
  sns_links: Record<string, string>;
  contract_status: "active" | "inactive";
  featured_flag: boolean;
  rating: number;
  works_count: number;
  instagram_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SnsPostRow = {
  id: string;
  stylist_id: string;
  platform: string;
  image_url: string;
  caption: string;
  posted_at: string;
  source_url: string | null;
  external_id: string | null;
  fetched_at: string;
};
