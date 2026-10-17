import { NextResponse, type NextRequest } from "next/server";
import { refreshAllTokens } from "@/lib/integrations/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Instagram / Threads の長期トークンを定期的に更新する（vercel.json の cron から毎日呼ばれる）。
 * Vercel は CRON_SECRET を設定しておくと Authorization: Bearer <CRON_SECRET> を付けて呼ぶ。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET が未設定です" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const results = await refreshAllTokens();
  return NextResponse.json({ ok: true, results, at: new Date().toISOString() });
}
