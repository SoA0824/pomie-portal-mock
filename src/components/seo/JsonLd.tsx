/**
 * 構造化データ（JSON-LD）を埋め込む。
 * Google が「記事」「美容室」「人物」などの情報を正しく理解するためのもの。
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON 内の "</script>" で HTML が壊れないようにエスケープする
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
