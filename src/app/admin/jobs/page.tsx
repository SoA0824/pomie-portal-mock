import { JobsList } from "@/components/admin/JobsList";
import { listJobs } from "@/lib/data/jobs";
import { dispatchConfigured } from "@/lib/integrations/github";

export const dynamic = "force-dynamic";
export const metadata = { title: "自動実行 | 管理 | POMiE Portal" };

export default async function AdminJobsPage() {
  const { jobs, error } = await listJobs(60);
  return (
    <div>
      <h1 className="font-display text-2xl text-ink-900">自動実行</h1>
      <p className="mt-1 text-sm text-ink-500">
        各画面の「API で…」ボタンで積まれた仕事（キーワード提案・記事の執筆・リライト案・SNS 投稿）の進み具合です。
        実行は GitHub Actions が 15 分ごと（またはボタンで即時）に行い、結果は下書き・提案として各画面に届きます。公開や投稿はここでは行いません。
      </p>
      {error && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          ジョブを読み込めませんでした（{error}）。<code className="rounded bg-white px-1">supabase/migration-015-jobs.sql</code> を実行してください。
        </div>
      )}
      <JobsList jobs={jobs} dispatchConfigured={dispatchConfigured()} />
    </div>
  );
}
