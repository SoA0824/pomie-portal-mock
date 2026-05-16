import type { InstagramFetcher, InstagramPost } from "./instagram";

const MOCK_CAPTIONS = [
  "本日のお客様。髪質改善トリートメントで艶のあるストレートに仕上げました ✨",
  "似合わせカラー × カット。お顔まわりに動きを出してすっきり小顔印象に。",
  "新しいハイライトデザイン。透明感のある仕上がりで春らしく。",
  "ボブのお客様。骨格に合わせた重さの調整で扱いやすいスタイルに。",
  "メンズパーマで朝のセット時短。ニュアンスのある毛流れを意識して。",
  "ブライダル前撮りヘアセット。後ろ姿まで美しく仕上げました。",
  "ヘッドスパ × トリートメント。頭皮から整えると髪が変わります。",
  "ご新規様 大歓迎です！ DM でも予約受付中。",
  "ロングヘアの方向けデジタルパーマ。ふんわりカール持続。",
  "色落ちまで楽しめるカラー設計を心がけています。",
  "今日のスタイルは縮毛矯正 + カラー。3 ヶ月後の仕上がりも安心。",
  "予約状況のお知らせ。来週の空き枠はストーリーで案内します。",
];

function pickCaption(seed: number): string {
  return MOCK_CAPTIONS[seed % MOCK_CAPTIONS.length];
}

function randomDateWithinDays(daysAgo: number): string {
  const now = Date.now();
  const past = now - daysAgo * 24 * 60 * 60 * 1000;
  const ts = past + Math.random() * (now - past);
  return new Date(ts).toISOString();
}

export function createMockFetcher(): InstagramFetcher {
  return {
    async fetchLatestPosts({ handle, limit = 8 }) {
      const posts: InstagramPost[] = [];
      for (let i = 0; i < limit; i++) {
        posts.push({
          externalId: `mock-${handle}-${i}`,
          imageUrl: `https://picsum.photos/seed/${encodeURIComponent(handle)}-${i}/600/600`,
          caption: pickCaption(i + handle.length),
          postedAt: randomDateWithinDays(60),
          sourceUrl: `https://www.instagram.com/${handle}/`,
        });
      }
      // 投稿日時で降順ソート
      posts.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
      return posts;
    },
  };
}
