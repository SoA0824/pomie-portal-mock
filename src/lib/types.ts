export const ARTICLE_CATEGORIES = ["カット", "カラー", "メンズ", "ケア", "エリア"] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

/** draft: 下書き（非公開・URL は 404） / published: 公開 */
export type ArticleStatus = "draft" | "published";

export type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  /** 本文（Markdown） */
  body: string;
  category: ArticleCategory;
  /** 公開日時。未公開の下書きは作成日時 */
  publishedAt: string;
  /** カバー画像（未設定なら空。表示時は articleCover() で既定画像にする） */
  coverImage: string;
  relatedStylistIds: string[];
  status: ArticleStatus;
  /** 狙う検索キーワード */
  targetKeyword: string | null;
  /** エリア（src/lib/areas.ts の slug。複数可） */
  areas: string[];
  /** manual: 手書き / ai: 自動執筆 */
  source: "manual" | "ai";
  /** 監修者（美容師を選んだ場合はその ID。その他の人の場合は名前と肩書） */
  supervisorStylistId: string | null;
  supervisorName: string | null;
  supervisorTitle: string | null;
  /** 自動執筆の元になったキーワード候補 */
  keywordCandidateId: string | null;
  /** 自動執筆の記録（モデル・トークン・検品結果） */
  generationLog: ArticleGenerationLog | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticleGenerationLog = {
  model?: string;
  generatedAt?: string;
  inputTokens?: number;
  outputTokens?: number;
  attempts?: number;
  rakkoCredits?: number;
  lintErrors?: string[];
  lintWarnings?: string[];
};

/** 記事ページに表示する監修者 */
export type ArticleSupervisor = {
  name: string;
  title: string;
  stylistId?: string;
  avatar?: string;
  /** プロフィールページ（美容師が公開中のときだけ） */
  url?: string;
};

export type SaveArticleInput = {
  /** 省略時は新規作成 */
  id?: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: ArticleCategory;
  coverImage: string;
  relatedStylistIds: string[];
  status: ArticleStatus;
  targetKeyword?: string;
  areas?: string[];
  /** 公開日時（ISO）。空なら公開時に現在時刻 */
  publishedAt?: string;
  supervisorStylistId?: string | null;
  supervisorName?: string;
  supervisorTitle?: string;
};

export type KeywordIntent = "booking" | "compare" | "info";
export type KeywordCandidateStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "writing"
  | "written"
  | "failed";

export type KeywordCandidate = {
  id: string;
  keyword: string;
  seed: string | null;
  searchVolume: number | null;
  seoDifficulty: number | null;
  competition: number | null;
  cpc: number | null;
  intent: KeywordIntent | null;
  category: ArticleCategory | null;
  suggestedTitle: string | null;
  angle: string | null;
  faqQuestions: string[];
  relatedKeywords: Array<{ keyword: string; searchVolume: number | null }>;
  targetStylistIds: string[];
  score: number | null;
  reason: string | null;
  status: KeywordCandidateStatus;
  note: string | null;
  articleId: string | null;
  error: string | null;
  proposedAt: string;
  decidedAt: string | null;
  writtenAt: string | null;
  updatedAt: string;
};

export type KeywordSeed = {
  id: string;
  keyword: string;
  enabled: boolean;
  note: string | null;
  lastUsedAt: string | null;
  createdAt: string;
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
  /**
   * 住所の正確性を確認済みか。
   * true のときだけ公開ページ・構造化データに住所を載せる（誤った住所で来店されるのを防ぐ）。
   */
  addressVerified?: boolean;
  area: string;
  /** 店舗のメイン写真のパス（public 配下）。画像が無い場合は表示側でフォールバック */
  image?: string;
  /** 店舗の追加写真（ギャラリー表示用。先頭はメイン写真と同じで可） */
  gallery?: string[];
  /** 店舗の魅力を伝える 1 行コピー */
  catchphrase?: string;
  /** 店舗紹介文。段落は空行で区切る */
  description?: string;
  /** 店舗の特徴（短い箇条書き） */
  features?: string[];
  /** アクセス（最寄り駅・出口・徒歩分数など） */
  access?: string;
  /** 営業時間（美容師により異なる場合はその旨も） */
  hours?: string;
  /** 定休日 */
  holidays?: string;
  /** 電話番号 */
  phone?: string;
  /** 地図リンク（Google マップの共有 URL など）。未設定で住所確認済みなら住所検索リンクを使う */
  mapUrl?: string;
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
