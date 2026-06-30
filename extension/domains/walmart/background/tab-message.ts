import { getActiveTabInWindow } from "@ext/core/background/window-active-tab.ts";
import { isWalmartUrl } from "@ext/domains/walmart/lib/host.ts";

export async function getActiveWalmartTabInWindow(
  windowId?: number,
): Promise<chrome.tabs.Tab | null> {
  const tab = await getActiveTabInWindow(windowId);
  if (tab?.id == null || !tab.url || !isWalmartUrl(tab.url)) {
    return null;
  }
  return tab;
}

export async function getActiveWalmartTab(): Promise<chrome.tabs.Tab | null> {
  return getActiveWalmartTabInWindow();
}

export async function sendToActiveWalmartTab(
  message: import("@ext/core/types/index.ts").BackgroundToContent,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tab = await getActiveWalmartTab();
  if (!tab?.id) {
    return { ok: false, error: "Open a Walmart tab in this window" };
  }
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return { ok: true };
  } catch {
    return { ok: false, error: "Walmart tab is not ready — refresh the page" };
  }
}
