import { useCallback, useEffect, useRef, useState } from "react";

import { resolveActiveTabKind } from "@ext/core/lib/active-tab.ts";
import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { patchRetailerOpenTabActive } from "@ext/domains/target/lib/index.ts";
import { patchWalmartOpenTabActive } from "@ext/domains/walmart/lib/index.ts";
import { getExtensionStatus } from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { patchStatusActiveTabKind } from "../patch-status-active-tab.ts";
import { enrichRetailerOpenTabHighlights } from "../../domains/target/hooks/retailer-open-tab-highlights.ts";
import { enrichWalmartOpenTabHighlights } from "../../domains/walmart/hooks/walmart-open-tab-highlights.ts";

function isHostWindowTabActivation(
  hostWindowId: number | undefined,
  activeInfo: chrome.tabs.TabActiveInfo,
): boolean {
  return hostWindowId == null || activeInfo.windowId === hostWindowId;
}

export function usePopupStatus() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hostWindowIdRef = useRef<number | undefined>(undefined);

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
    void chrome.windows.getCurrent().then((window) => {
      hostWindowIdRef.current = window.id ?? undefined;
    });

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

    function patchOpenTabHighlights(
      prev: ExtensionStatus,
      activeTabId: number,
    ): ExtensionStatus {
      let next = prev;
      if (prev.walmart_open_tabs.length > 0) {
        next = {
          ...next,
          walmart_open_tabs: patchWalmartOpenTabActive(prev.walmart_open_tabs, activeTabId),
        };
      }
      if (prev.retailer_open_tabs.length > 0) {
        next = {
          ...next,
          retailer_open_tabs: patchRetailerOpenTabActive(prev.retailer_open_tabs, activeTabId),
        };
      }
      return next;
    }

    function onTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
      if (!isHostWindowTabActivation(hostWindowIdRef.current, activeInfo)) {
        return;
      }

      void (async () => {
        try {
          const tab = await chrome.tabs.get(activeInfo.tabId);
          setStatus((prev) => {
            if (!prev) {
              return prev;
            }
            return patchOpenTabHighlights(
              patchStatusActiveTabKind(prev, tab.url),
              activeInfo.tabId,
            );
          });
        } catch {
          setStatus((prev) => {
            if (!prev) {
              return prev;
            }
            return patchOpenTabHighlights(prev, activeInfo.tabId);
          });
        }
        void refresh();
      })();
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
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) {
      const url = changeInfo.url ?? tab.url;
      const shouldReact =
        isRelevantTabUrl(changeInfo.url) ||
        (changeInfo.title != null && isRelevantTabUrl(tab.url)) ||
        (changeInfo.status === "complete" && isRelevantTabUrl(tab.url));

      if (!shouldReact) {
        return;
      }

      void (async () => {
        const hostWindowId = hostWindowIdRef.current;
        if (hostWindowId != null) {
          const [activeTab] = await chrome.tabs.query({ active: true, windowId: hostWindowId });
          if (activeTab?.id !== tabId) {
            return;
          }
        }

        setStatus((prev) => (prev ? patchStatusActiveTabKind(prev, url) : prev));
        void refresh();
      })();
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
