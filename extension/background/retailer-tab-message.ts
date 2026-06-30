import { bindRetailerTab } from "@ext/background/retailer-runtime-state.ts";
import { getActiveTabInWindow } from "@ext/background/window-active-tab.ts";
import { isRetailerUrl } from "@ext/lib/retailer/host.ts";
import type { BackgroundResponse, BackgroundToContent } from "@ext/types/index.ts";

export async function getActiveRetailerTabInWindow(
  windowId?: number,
): Promise<chrome.tabs.Tab | null> {
  const tab = await getActiveTabInWindow(windowId);
  if (tab?.id == null || !tab.url || !isRetailerUrl(tab.url)) {
    return null;
  }
  return tab;
}

export async function sendToActiveRetailerTab(
  message: BackgroundToContent,
  options?: { bindManual?: boolean; windowId?: number },
): Promise<BackgroundResponse> {
  const tab = await getActiveRetailerTabInWindow(options?.windowId);
  if (!tab?.id) {
    return { ok: false, error: "Open a Target tab in this window" };
  }

  if (options?.bindManual) {
    bindRetailerTab(tab.id, "manual");
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Target tab is not ready — refresh the page",
    };
  }
}
