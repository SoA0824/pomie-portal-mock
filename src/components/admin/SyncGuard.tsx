"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const LEAVE_MESSAGE =
  "Instagram の投稿を取得中です。このページを離れると取得が中断されます。移動してもよろしいですか？";

type SyncGuardValue = {
  /** 実行中の取得件数 */
  activeCount: number;
  begin: () => void;
  end: () => void;
};

const SyncGuardContext = createContext<SyncGuardValue>({
  activeCount: 0,
  begin: () => {},
  end: () => {},
});

export function useSyncGuard() {
  return useContext(SyncGuardContext);
}

/**
 * Instagram 取得中のページ離脱を防ぐガード。
 *
 * - タブを閉じる / リロード → ブラウザ標準の確認ダイアログ（beforeunload）
 * - サイト内リンクでの移動 → confirm() で確認し、キャンセルならとどまる
 *
 * どちらも「OK で移動・閉じる / キャンセルでとどまる」の挙動になる。
 */
export function SyncGuardProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);

  const begin = useCallback(() => setActiveCount((n) => n + 1), []);
  const end = useCallback(() => setActiveCount((n) => Math.max(0, n - 1)), []);

  const busy = activeCount > 0;

  // タブを閉じる / リロード / 別サイトへ移動
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 一部ブラウザは returnValue の設定が必要（文言はブラウザ既定が使われる）
      e.returnValue = LEAVE_MESSAGE;
      return LEAVE_MESSAGE;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  // サイト内リンク（<a>）での移動
  useEffect(() => {
    if (!busy) return;
    const onClickCapture = (e: MouseEvent) => {
      // 修飾キー付き・右クリックなどは通常の挙動に任せる
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // 別タブで開くリンクは現在のページを離れないので対象外
      if (anchor.getAttribute("target") === "_blank") return;

      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // capture フェーズで拾って Next.js の Link より先に判定する
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [busy]);

  const value = useMemo(
    () => ({ activeCount, begin, end }),
    [activeCount, begin, end]
  );

  return (
    <SyncGuardContext.Provider value={value}>
      {children}
      {busy && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-pomie-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]" />
          Instagram 取得中（{activeCount} 件）… ページを離れないでください
        </div>
      )}
    </SyncGuardContext.Provider>
  );
}
