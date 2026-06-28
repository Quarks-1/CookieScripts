import { useCallback, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import { resolveActiveTabKind } from "@ext/lib/active-tab.ts";
import { getExtensionStatus } from "@ext/lib/messages.ts";
import type { ExtensionStatus } from "@ext/types/index.ts";

export function usePopupStatus() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getExtensionStatus();
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    function onFocus() {
      void refresh();
    }

    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (area !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.settings] || changes[STORAGE_KEYS.history]) {
        void refresh();
      }
    }

    function onTabActivated() {
      void refresh();
    }

    function isRelevantTabUrl(url: string | undefined): boolean {
      if (!url) {
        return false;
      }
      return (
        url.startsWith("https://discord.com/channels/") || resolveActiveTabKind(url) === "retailer"
      );
    }

    function onTabUpdated(
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) {
      if (
        isRelevantTabUrl(changeInfo.url) ||
        (changeInfo.status === "complete" && isRelevantTabUrl(tab.url))
      ) {
        void refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [refresh]);

  return { status, loading, error, refresh };
}
