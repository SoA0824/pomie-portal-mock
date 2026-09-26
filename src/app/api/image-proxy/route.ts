import { NextResponse } from "next/server";
import { fetchInstagramImage } from "@/lib/instagramCdn";

export const runtime = "edge";

// Instagram の画像 CDN ドメインのみ許可（オープンプロキシ化を防ぐ）
const ALLOWED_HOST_PATTERNS = [
  /\.cdninstagram\.com$/,
  /\.fbcdn\.net$/,
];

function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOST_PATTERNS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/**
 * 画像プロキシ: Instagram CDN の画像をサーバー経由で配信する。
 * 直接 <img src="https://scontent-...cdninstagram.com/..."> だとホットリンク防止で表示できないことが多いため。
 *
 * 使い方:
 *   <img src={`/api/image-proxy?url=${encodeURIComponent(igUrl)}`} />
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) {
    return new NextResponse("missing url", { status: 400 });
  }
  if (!isAllowed(target)) {
    return new NextResponse("host not allowed", { status: 403 });
  }

  try {
    // 元の URL → 公開 CDN ホストに差し替えた URL の順に試す
    // （地域限定キャッシュ *.fna.fbcdn.net は外部から名前解決できないため）
    const fetched = await fetchInstagramImage(target);
    if (!fetched.res) {
      return new NextResponse(`upstream failed: ${fetched.reasons.join(" / ")}`, {
        status: 502,
      });
    }
    const upstream = fetched.res;

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 1 日キャッシュ（IG CDN の oe トークンも数時間〜数日有効）
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch_error";
    return new NextResponse(msg, { status: 502 });
  }
}
