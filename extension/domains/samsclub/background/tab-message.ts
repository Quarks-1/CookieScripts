import { getActiveTabInWindow } from "@ext/core/background/window-active-tab.ts";
import { isSamsclubUrl } from "@ext/domains/samsclub/lib/host.ts";

export async function getActiveSamsclubTabInWindow(
  windowId?: number,
): Promise<chrome.tabs.Tab | null> {
  const tab = await getActiveTabInWindow(windowId);
  if (tab?.id == null || !tab.url || !isSamsclubUrl(tab.url)) {
    return null;
  }
  return tab;
}

export async function getActiveSamsclubTab(): Promise<chrome.tabs.Tab | null> {
  return getActiveSamsclubTabInWindow();
}

export async function sendToActiveSamsclubTab(
  message: import("@ext/core/types/index.ts").BackgroundToContent,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tab = await getActiveSamsclubTab();
  if (!tab?.id) {
    return { ok: false, error: "Open a Samsclub tab in this window" };
  }
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return { ok: true };
  } catch {
    return { ok: false, error: "Samsclub tab is not ready — refresh the page" };
  }
}
