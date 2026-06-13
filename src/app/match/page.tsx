import { MatchQuiz } from "@/components/match/MatchQuiz";
import { getAllPublishedStylists } from "@/lib/data/stylists";
import { getAllStores } from "@/lib/data/stores";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "あなたにぴったりの美容師を診断 | POMiE Portal",
  description:
    "髪のお悩み・希望スタイル・店舗エリア・予算から、相性のいい美容師を診断します。",
};

export default async function MatchPage() {
  const stylists = await getAllPublishedStylists();
  const stores = getAllStores();
  const storesById = Object.fromEntries(stores.map((s) => [s.id, s]));

  return (
    <div className="container-page py-12">
      <MatchQuiz stylists={stylists} storesById={storesById} />
    </div>
  );
}
