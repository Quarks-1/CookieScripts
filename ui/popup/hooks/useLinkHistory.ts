import { useCallback, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import { clearLinkHistory, getLinkHistory } from "@ext/lib/messages.ts";
import type { HistoryItem } from "@ext/types/index.ts";

export function useLinkHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const items = await getLinkHistory();
      setHistory(items);
    } catch {
      // non-critical on refresh failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (area === "local" && changes[STORAGE_KEYS.history]) {
        void refresh();
      }
    }

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [refresh]);

  async function handleClearHistory() {
    setClearing(true);
    setClearMessage(null);
    try {
      await clearLinkHistory();
      setHistory([]);
      setClearMessage("History cleared");
    } catch (err) {
      setClearMessage(err instanceof Error ? err.message : "Failed to clear history");
    } finally {
      setClearing(false);
    }
  }

  return {
    history,
    loading,
    clearing,
    clearMessage,
    handleClearHistory,
  };
}
