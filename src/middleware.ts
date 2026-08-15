import { NextResponse, type NextRequest } from "next/server";

/**
 * 管理系ルートの簡易 Basic 認証。
 *
 * テスト運用フェーズでは実際の顧客情報（氏名・連絡先）を扱うため、
 * /admin と /stylist を無防備に公開しない。
 *
 * 環境変数:
 *   ADMIN_BASIC_USER / ADMIN_BASIC_PASSWORD  … 両方セットされたときだけ有効
 *
 * 未設定の場合は素通し（ローカル開発・モック環境ではこれまで通り）。
 * 本番フェーズでは Supabase Auth + RLS に置き換える前提の暫定措置。
 */
export function middleware(request: NextRequest) {
  const user = process.env.ADMIN_BASIC_USER;
  const password = process.env.ADMIN_BASIC_PASSWORD;

  // 認証情報が未設定なら何もしない（ローカル/モック用）
  if (!user || !password) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (header) {
    const encoded = header.split(" ")[1] ?? "";
    // Edge ランタイムでは Buffer が使えないため atob を使用
    const decoded = atob(encoded);
    const idx = decoded.indexOf(":");
    const inputUser = decoded.slice(0, idx);
    const inputPass = decoded.slice(idx + 1);
    if (inputUser === user && inputPass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="POMiE Admin", charset="UTF-8"' },
  });
}

export const config = {
  // 注意: "/stylist/:path*" だけだと公開ページの /stylists（美容師一覧）にも
  // マッチしてしまい、一般ユーザーに認証ダイアログが出てしまう。
  // 美容師管理画面のトップ /stylist と、その配下だけを厳密に対象にする。
  matcher: ["/admin", "/admin/:path*", "/stylist", "/stylist/:path+"],
};
