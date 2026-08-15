export type ArticleCategory = "カット" | "カラー" | "メンズ" | "ケア" | "エリア";

export type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: ArticleCategory;
  publishedAt: string;
  coverImage: string;
  relatedStylistIds: string[];
};

export type SnsPlatform = "instagram" | "x" | "tiktok";

export type StylistMenu = {
  name: string;
  duration: number; // 施術時間（分）
};

/** 予約受付の方式 */
export type BookingMode = "pomie" | "external";

/** 美容師独自の予約受付リンク（Web フォーム / Instagram DM など） */
export type BookingLink = {
  /** ボタンに表示するテキスト（例: 「Web フォームで予約」「Instagram DM で予約」） */
  label: string;
  /** 遷移先 URL */
  url: string;
};

export type Stylist = {
  id: string;
  name: string;
  nameKana: string;
  avatar: string;
  profile: string;
  storeId: string;
  area: string;
  /** 強み（表示用キャッチフレーズ） */
  strengths: string[];
  /** 得意メニュー（表示用タグ・予約とは独立） */
  specialtyMenus: string[];
  /** 予約可能メニュー（施術時間つき） */
  menus: StylistMenu[];
  priceRange: { min: number; max: number };
  availableTimeSlots: string[];
  instagramHandle?: string | null;
  snsLinks: Partial<Record<SnsPlatform, string>>;
  contractStatus: "active" | "inactive";
  featuredFlag: boolean;
  rating: number;
  worksCount: number;
  instagramSyncedAt?: string | null;
  /** 詳細ページのヒーロー背景画像。未設定なら所属店舗のメイン画像を使用 */
  backgroundImage?: string | null;
  /** 予約受付の方式（既定: external = 美容師独自受付） */
  bookingMode: BookingMode;
  /** bookingMode が external のときに表示する予約リンク群 */
  bookingLinks: BookingLink[];
};

export type CreateStylistInput = {
  name: string;
  nameKana?: string;
  avatar?: string;
  profile: string;
  storeId: string;
  strengths?: string[];
  specialtyMenus?: string[];
  menus: StylistMenu[];
  priceRange: { min: number; max: number };
  /** 省略時は自動でダミー枠を生成 */
  availableTimeSlots?: string[];
  instagramHandle?: string;
  backgroundImage?: string;
  bookingMode?: BookingMode;
  bookingLinks?: BookingLink[];
  contractStatus: "active" | "inactive";
  featuredFlag: boolean;
};

export type UpdateStylistInput = CreateStylistInput & {
  id: string;
};

export type SnsPost = {
  id: string;
  stylistId: string;
  platform: SnsPlatform;
  imageUrl: string;
  caption: string;
  postedAt: string;
};

export type Store = {
  id: string;
  name: string;
  address: string;
  area: string;
  /** 店舗のメイン写真のパス（public 配下）。画像が無い場合は表示側でフォールバック */
  image?: string;
  /** 店舗の追加写真（ギャラリー表示用。先頭はメイン写真と同じで可） */
  gallery?: string[];
  /** 店舗の魅力を伝える 1 行コピー */
  catchphrase?: string;
  salonboardShopId: string;
  salonboardCapacityPerSlot: number;
};

export type SalonboardSyncStatus = "reserved" | "unavailable" | "pending" | "failed";

export type Reservation = {
  id: string;
  customerName: string;
  customerContact: string;
  stylistId: string;
  storeId: string;
  menus: string[];
  durationMinutes: number;
  desiredDateTime: string;
  channel: "web" | "line";
  status: "confirmed" | "pending" | "rejected";
  salonboard: {
    status: SalonboardSyncStatus;
    bookingId?: string;
    syncedAt?: string;
    errorMessage?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateReservationInput = {
  customerName: string;
  customerContact: string;
  stylistId: string;
  menus: string[];
  desiredDateTime: string;
  channel: "web" | "line";
};

export type CreateReservationResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: string; reservation?: Reservation };

export interface SalonboardClient {
  checkAvailability(input: { shopId: string; dateTime: string }): Promise<{
    available: boolean;
    remaining: number;
    capacity: number;
  }>;
  createBooking(input: {
    shopId: string;
    dateTime: string;
    stylistName: string;
    customerName: string;
    customerContact: string;
    menu: string;
  }): Promise<{ ok: true; bookingId: string } | { ok: false; reason: string }>;
  cancelBooking(input: { bookingId: string }): Promise<{ ok: boolean }>;
  listMockBookings?(): Promise<
    Array<{ bookingId: string; shopId: string; dateTime: string; stylistName: string; customerName: string }>
  >;
}
