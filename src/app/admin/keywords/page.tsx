import { KeywordCandidateList } from "@/components/admin/KeywordCandidateList";
import { KeywordSeeds } from "@/components/admin/KeywordSeeds";
import { listKeywordCandidates, listKeywordSeeds } from "@/lib/data/keywords";
import { getStylistOptions } from "@/lib/data/stylistOptions";
import type { KeywordCandidate, KeywordSeed } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "キーワード候補 | 管理 | POMiE Portal" };

export default async function AdminKeywordsPage() {
  let candidates: KeywordCandidate[] = [];
  let seeds: KeywordSeed[] = [];
  let loadError: string | null = null;
  try {
    [candidates, seeds] = await Promise.all([listKeywordCandidates(), listKeywordSeeds()]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  const stylists = await getStylistOptions();

  const count = (s: KeywordCandidate["status"]) => candidates.filter((c) => c.status === s).length;

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">キーワード候補</h1>
        <p className="mt-1 text-sm text-ink-500">
          自動で集めた記事のキーワード候補です。<strong>承認</strong>した候補は次回の自動実行で記事（下書き）になり、
          記事一覧で内容を確認してから公開します。
        </p>
      </header>

      {loadError && (
        <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">候補を読み込めませんでした</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-xs">
            テーブルが未作成の可能性があります。Supabase の SQL Editor で
            <code className="mx-1">supabase/migration-009-keyword-pipeline.sql</code>を実行してください。
          </p>
        </div>
      )}

      {!loadError && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            <Stat label="提案中" value={count("proposed")} accent />
            <Stat label="承認済み（記事化待ち）" value={count("approved") + count("writing")} />
            <Stat label="記事化済み" value={count("written")} />
            <Stat label="失敗" value={count("failed")} warn={count("failed") > 0} />
            <Stat label="却下" value={count("rejected")} />
          </div>

          <div className="mt-8">
            <KeywordCandidateList candidates={candidates} stylists={stylists} />
          </div>

          <div className="mt-10">
            <KeywordSeeds seeds={seeds} />
          </div>

          <section className="mt-10 rounded-xl bg-white p-5 text-sm ring-1 ring-ink-100">
            <h2 className="font-bold">動き方</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-700">
              <li>
                週 1 回、種キーワードをもとにラッコキーワードで調査し、候補を<strong>提案中</strong>として追加します
                （手動で実行する場合は <code>node scripts/articles/run.mjs propose</code>）。
              </li>
              <li>管理者が候補を見て<strong>承認</strong>または<strong>却下</strong>します。承認時のメモは執筆に渡されます。</li>
              <li>
                毎日、承認済みの候補から順に記事を自動執筆し、<strong>下書き</strong>として記事一覧に追加します
                （手動: <code>node scripts/articles/run.mjs write</code>）。
              </li>
              <li>記事一覧で内容を確認し、必要なら監修者を付けて<strong>承認して公開</strong>します。</li>
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ring-1 ${
        warn ? "bg-red-50 ring-red-200" : accent ? "bg-pomie-50 ring-pomie-200" : "bg-white ring-ink-100"
      }`}
    >
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
