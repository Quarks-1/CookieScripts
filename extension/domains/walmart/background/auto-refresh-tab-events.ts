import {
  clearWalmartTabAutoRefresh,
  hasWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { pushWalmartAutoRefreshConfigToTab } from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import { WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC } from "@ext/domains/walmart/lib/auto-refresh.ts";
import { isWalmartUrl } from "@ext/domains/walmart/lib/host.ts";

export function onAutoRefreshTabRemoved(tabId: number): void {
  clearWalmartTabAutoRefresh(tabId);
}

export async function onAutoRefreshTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  if (changeInfo.url == null) {
    return;
  }

  const tabUrl = tab.url ?? changeInfo.url;
  if (!tabUrl || isWalmartUrl(tabUrl)) {
    return;
  }

  if (!hasWalmartTabAutoRefresh(tabId)) {
    return;
  }

  clearWalmartTabAutoRefresh(tabId);
  await pushWalmartAutoRefreshConfigToTab(tabId, {
    enabled: false,
    interval_sec: WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
    pause: false,
  });
}
