import { waitForTabComplete } from "@ext/core/background/open-product-link.ts";
import {
  bindSamsclubTab,
  getSamsclubTabSession,
  listRecordingTabIds,
  unbindSamsclubTab,
} from "@ext/domains/samsclub/background/runtime-state.ts";
import { isSamsclubUrl } from "@ext/domains/samsclub/lib/host.ts";
import { sleep } from "@ext/core/lib/sleep.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";

const SAMSCLUB_TAB_URL_PATTERNS = ["https://www.samsclub.com/*", "https://samsclub.com/*"] as const;

const SEND_RETRIES = 3;
const SEND_RETRY_MS = 500;

export async function listAllSamsclubTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ url: [...SAMSCLUB_TAB_URL_PATTERNS] });
}

export async function sendToSamsclubTab(
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
  if (activeTab?.id != null && activeTab.url && isSamsclubUrl(activeTab.url)) {
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
  if (getSamsclubTabSession(tabId) === sessionId) {
    return "attached";
  }

  bindSamsclubTab(tabId, sessionId);
  const ok = await sendToSamsclubTab(tabId, {
    type: "SAMSCLUB_RECORDING_START",
    sessionId,
    tabId,
    joinMode: opts.joinMode,
  });
  if (!ok) {
    unbindSamsclubTab(tabId);
    return "failed";
  }
  return "attached";
}
