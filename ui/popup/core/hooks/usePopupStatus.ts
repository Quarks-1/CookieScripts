import { useCallback, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { resolveActiveTabKind } from "@ext/core/lib/active-tab.ts";
import { patchRetailerOpenTabActive } from "@ext/domains/target/lib/index.ts";
import { patchWalmartOpenTabActive } from "@ext/domains/walmart/lib/index.ts";
import { getExtensionStatus } from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { enrichRetailerOpenTabHighlights } from "../../domains/target/hooks/retailer-open-tab-highlights.ts";
import { enrichWalmartOpenTabHighlights } from "../../domains/walmart/hooks/walmart-open-tab-highlights.ts";

export function usePopupStatus() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await enrichRetailerOpenTabHighlights(
        await enrichWalmartOpenTabHighlights(await getExtensionStatus()),
      );
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
      if (area === "local") {
        if (changes[STORAGE_KEYS.settings] || changes[STORAGE_KEYS.history]) {
          void refresh();
        }
        return;
      }
      if (
        area === "session" &&
        (changes[STORAGE_KEYS.walmartMetrics] ||
          changes[STORAGE_KEYS.walmartLastExport] ||
          changes[STORAGE_KEYS.statusRevision])
      ) {
        void refresh();
      }
    }

    function onTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
      setStatus((prev) => {
        if (!prev) {
          return prev;
        }
        let next = prev;
        if (prev.walmart_open_tabs.length > 0) {
          next = {
            ...next,
            walmart_open_tabs: patchWalmartOpenTabActive(prev.walmart_open_tabs, activeInfo.tabId),
          };
        }
        if (prev.retailer_open_tabs.length > 0) {
          next = {
            ...next,
            retailer_open_tabs: patchRetailerOpenTabActive(prev.retailer_open_tabs, activeInfo.tabId),
          };
        }
        return next === prev ? prev : next;
      });
      void refresh();
    }

    function onWindowFocusChanged() {
      void refresh();
    }

    function isRelevantTabUrl(url: string | undefined): boolean {
      if (!url) {
        return false;
      }
      return (
        url.startsWith("https://discord.com/channels/") ||
        resolveActiveTabKind(url) === "retailer" ||
        resolveActiveTabKind(url) === "walmart"
      );
    }

    function onTabUpdated(
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) {
      if (
        isRelevantTabUrl(changeInfo.url) ||
        (changeInfo.title && isRelevantTabUrl(tab.url)) ||
        (changeInfo.status === "complete" && isRelevantTabUrl(tab.url))
      ) {
        void refresh();
      }
    }

    function onTabRemoved() {
      void refresh();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.tabs.onRemoved.removeListener(onTabRemoved);
      chrome.windows.onFocusChanged.removeListener(onWindowFocusChanged);
    };
  }, [refresh]);

  return { status, loading, error, refresh };
}
