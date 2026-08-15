/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Supabase Storage（美容師のアバター・背景画像）
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
