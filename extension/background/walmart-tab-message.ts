import { isWalmartUrl } from "@ext/lib/walmart/host.ts";

export async function getActiveWalmartTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null || !tab.url || !isWalmartUrl(tab.url)) {
    return null;
  }
  return tab;
}

export async function sendToActiveWalmartTab(
  message: import("@ext/types/index.ts").BackgroundToContent,
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
