import { NextResponse } from "next/server";

/**
 * LINE Messaging API Webhook 受け口（スタブ）。
 *
 * 本番化時の流れ:
 *  1. LINE Developers でチャネルを作成し、署名検証を実装する。
 *  2. 受信したテキスト/postback を ChatWindow と同じ会話エンジンに渡す。
 *  3. 会話エンジンの返り値（次の問いかけ + クイックリプライ）を LINE に push する。
 *  4. 予約確定時は src/server/actions/createReservation を呼び、Salonboard 連携を共有する。
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "このエンドポイントは MVP モックではスタブ実装です。/line-bot のチャットモック画面で予約フローを試せます。",
    },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, status: "stub" });
}
