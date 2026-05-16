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

export type Stylist = {
  id: string;
  name: string;
  nameKana: string;
  avatar: string;
  profile: string;
  storeId: string;
  area: string;
  menus: string[];
  priceRange: { min: number; max: number };
  availableTimeSlots: string[];
  instagramHandle?: string | null;
  snsLinks: Partial<Record<SnsPlatform, string>>;
  contractStatus: "active" | "inactive";
  featuredFlag: boolean;
  rating: number;
  worksCount: number;
  instagramSyncedAt?: string | null;
};

export type CreateStylistInput = {
  name: string;
  nameKana?: string;
  avatar?: string;
  profile: string;
  storeId: string;
  menus: string[];
  priceRange: { min: number; max: number };
  instagramHandle?: string;
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
  menu: string;
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
  menu: string;
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
