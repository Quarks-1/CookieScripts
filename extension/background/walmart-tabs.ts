import { waitForTabComplete } from "@ext/background/open-product-link.ts";
import {
  bindWalmartTab,
  getWalmartTabSession,
  listRecordingTabIds,
  unbindWalmartTab,
} from "@ext/background/walmart-runtime-state.ts";
import { isWalmartUrl } from "@ext/lib/walmart/host.ts";
import { sleep } from "@ext/lib/sleep.ts";
import type { BackgroundToContent } from "@ext/types/index.ts";

const WALMART_TAB_URL_PATTERNS = ["https://www.walmart.com/*", "https://walmart.com/*"] as const;

const SEND_RETRIES = 3;
const SEND_RETRY_MS = 500;

export async function listAllWalmartTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ url: [...WALMART_TAB_URL_PATTERNS] });
}

export async function sendToWalmartTab(
  tabId: number,
  message: BackgroundToContent,
): Promise<boolean> {
  for (let attempt = 0; attempt < SEND_RETRIES; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return true;
    } catch {
      await waitForTabComplete(tabId);
      await sleep(SEND_RETRY_MS);
    }
  }
  return false;
}

export async function broadcastToRecordingTabs(
  sessionId: string,
  message: BackgroundToContent,
): Promise<void> {
  const tabIds = listRecordingTabIds(sessionId);
  await Promise.all(
    tabIds.map(async (tabId) => {
      try {
        await chrome.tabs.sendMessage(tabId, message);
      } catch {
        // Tab may be closing.
      }
    }),
  );
}

export async function pickPrimaryTabId(tabs: chrome.tabs.Tab[]): Promise<number | null> {
  if (tabs.length === 0) {
    return null;
  }
  const withIds = tabs.filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id != null);
  if (withIds.length === 0) {
    return null;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab?.id != null && activeTab.url && isWalmartUrl(activeTab.url)) {
    const match = withIds.find((tab) => tab.id === activeTab.id);
    if (match) {
      return match.id;
    }
  }

  return withIds.reduce((lowest, tab) => (tab.id < lowest ? tab.id : lowest), withIds[0].id);
}

export async function attachTabToRecording(
  tabId: number,
  sessionId: string,
  opts: { joinMode: "primary" | "late"; tabUrl: string },
): Promise<"attached" | "failed"> {
  if (getWalmartTabSession(tabId) === sessionId) {
    return "attached";
  }

  bindWalmartTab(tabId, sessionId);
  const ok = await sendToWalmartTab(tabId, {
    type: "WALMART_RECORDING_START",
    sessionId,
    tabId,
    joinMode: opts.joinMode,
  });
  if (!ok) {
    unbindWalmartTab(tabId);
    return "failed";
  }
  return "attached";
}
