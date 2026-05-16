import { NextResponse } from "next/server";

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
    const upstream = await fetch(target, {
      headers: {
        // IG ドメインから来たフリで取りに行く
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.instagram.com/",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      // IG CDN は普通の GET で取れる。再走 OK な無認証アクセス。
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new NextResponse(`upstream ${upstream.status}`, {
        status: upstream.status,
      });
    }

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
