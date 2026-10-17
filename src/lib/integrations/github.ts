/**
 * GitHub Actions の「自動実行」ワークフローを管理画面から起動する（workflow_dispatch）。
 * トークンが無ければ起動しない（1 時間ごとの定期実行で処理される）。
 */
const DEFAULT_REPO = "SoA0824/pomie-portal-mock";

export function dispatchConfigured(): boolean {
  return Boolean(process.env.GITHUB_DISPATCH_TOKEN);
}

export async function triggerRunner(): Promise<{ triggered: boolean; error?: string }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { triggered: false, error: "GITHUB_DISPATCH_TOKEN が未設定のため、1 時間ごとの定期実行で処理されます" };
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const workflow = process.env.GITHUB_WORKFLOW_FILE || "jobs.yml";
  const base = (process.env.GITHUB_API_BASE || "https://api.github.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: process.env.GITHUB_BRANCH || "main", inputs: { task: "run" } }),
      cache: "no-store",
    });
    if (res.status === 204) return { triggered: true };
    const text = await res.text();
    const hint = res.status === 401 || res.status === 403 ? "（トークンの権限に Actions: Read and write が必要です）" : res.status === 404 ? "（リポジトリ名かワークフロー名が違います）" : "";
    return { triggered: false, error: `GitHub の起動に失敗（${res.status}）${hint}: ${text.slice(0, 160)}` };
  } catch (err) {
    return { triggered: false, error: `GitHub に接続できません: ${err instanceof Error ? err.message : String(err)}` };
  }
}
