import { JobsList } from "@/components/admin/JobsList";
import { listJobs } from "@/lib/data/jobs";
import { dispatchConfigured } from "@/lib/integrations/github";

export const dynamic = "force-dynamic";
export const metadata = { title: "自動実行 | 管理 | POMiE Portal" };

/** 定期実行（.github/workflows/jobs.yml の cron は UTC）の次回時刻 */
function nextRuns(now = new Date()) {
  // 毎時 30 分（cron "30 * * * *"）
  const nextHourly = new Date(now);
  nextHourly.setUTCSeconds(0, 0);
  if (nextHourly.getUTCMinutes() >= 30) nextHourly.setUTCHours(nextHourly.getUTCHours() + 1);
  nextHourly.setUTCMinutes(30);
  const daily = new Date(now);
  daily.setUTCHours(18, 0, 0, 0); // 03:00 JST
  if (daily <= now) daily.setUTCDate(daily.getUTCDate() + 1);
  const weekly = new Date(now);
  weekly.setUTCHours(20, 0, 0, 0); // 月曜 05:00 JST = 日曜 20:00 UTC
  weekly.setUTCDate(weekly.getUTCDate() + ((7 - weekly.getUTCDay()) % 7));
  if (weekly <= now) weekly.setUTCDate(weekly.getUTCDate() + 7);
  const fmt = (d: Date) => d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
  return { nextHourly: fmt(nextHourly), daily: fmt(daily), weekly: fmt(weekly) };
}

export default async function AdminJobsPage() {
  const { jobs, error } = await listJobs(60);
  return (
    <div>
      <h1 className="font-display text-2xl text-ink-900">自動実行</h1>
      <p className="mt-1 text-sm text-ink-500">
        各画面の「API で…」ボタンで積まれた仕事（キーワード提案・記事の執筆・リライト案・SNS 投稿）の進み具合です。
        実行は GitHub Actions が 1 時間ごと（またはボタンで即時）に行い、結果は下書き・提案として各画面に届きます。公開や投稿はここでは行いません。
      </p>
      {error && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          ジョブを読み込めませんでした（{error}）。<code className="rounded bg-white px-1">supabase/migration-015-jobs.sql</code> を実行してください。
        </div>
      )}
      <ScheduleBox />
      <JobsList jobs={jobs} dispatchConfigured={dispatchConfigured()} />
    </div>
  );
}

function ScheduleBox() {
  const n = nextRuns();
  return (
    <section className="mt-4 rounded-xl bg-white p-4 text-xs ring-1 ring-ink-100">
      <p className="font-semibold text-ink-900">定期実行の予定（GitHub Actions。数分〜十数分遅れることがあります）</p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-3">
        <li>
          <span className="text-ink-500">待ちジョブの実行</span>
          <br />
          1 時間ごと・毎時 30 分（次回 {n.nextHourly}）
        </li>
        <li>
          <span className="text-ink-500">承認済み候補の記事化（2 本まで）</span>
          <br />
          毎日 03:00（次回 {n.daily}）
        </li>
        <li>
          <span className="text-ink-500">キーワード候補の提案（8 件）</span>
          <br />
          毎週月曜 05:00（次回 {n.weekly}）・ラッコの API キーが必要
        </li>
      </ul>
    </section>
  );
}
