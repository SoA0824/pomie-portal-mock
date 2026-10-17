import Link from "next/link";
import { IntegrationSettings } from "@/components/admin/IntegrationSettings";
import { listIntegrationStatus } from "@/lib/integrations/tokens";

export const dynamic = "force-dynamic";

export default async function SocialSettingsPage() {
  const { statuses, secretConfigured, error } = await listIntegrationStatus();
  return (
    <div>
      <Link href="/admin/social" className="text-sm text-pomie-600 hover:underline">
        ← SNS 投稿の一覧に戻る
      </Link>
      <h1 className="mt-3 font-display text-2xl text-ink-900">SNS の連携設定</h1>
      <p className="mt-1 text-sm text-ink-500">
        Instagram と Threads は、ここでトークンを登録すると管理画面から直接投稿できます（X は手動のまま）。
        トークンは暗号化して保存し、期限（60 日）が切れる前に自動で更新します。
      </p>
      <IntegrationSettings statuses={statuses} secretConfigured={secretConfigured} loadError={error} />
    </div>
  );
}
