import { NextResponse, type NextRequest } from "next/server";
import { getArticleByIdIncludingDrafts } from "@/lib/data/articles";
import { getSocialPostById } from "@/lib/data/social";
import { buildSlideContext, renderSlide } from "@/lib/social/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * スライドのプレビュー画像。/admin 配下なので Basic 認証がかかる。
 *   /admin/api/social/slide?post=<id>&i=<0 始まりの番号>&w=<幅。既定 540>
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("post") ?? "";
  const index = Number(sp.get("i") ?? "0");
  const width = Number(sp.get("w") ?? "540");
  const post = await getSocialPostById(id);
  if (!post) return new NextResponse("投稿が見つかりません", { status: 404 });
  if (!Number.isInteger(index) || !post.slides[index]) return new NextResponse("スライドがありません", { status: 404 });
  const article = await getArticleByIdIncludingDrafts(post.articleId);
  try {
    return await renderSlide(post, buildSlideContext(article), index, { width: Number.isFinite(width) ? width : 540 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`描画に失敗しました: ${message}`, { status: 500 });
  }
}
