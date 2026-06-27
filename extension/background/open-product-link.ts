import {
  bindRetailerTab,
  registerRetailerWindow,
  releaseRetailerJob,
  tryAcquireRetailerJob,
} from "@ext/background/retailer-runtime-state.ts";
import { getRetailerAutoEnabled } from "@ext/lib/retailer/channel-config.ts";
import { isRetailerProductUrl } from "@ext/lib/retailer/host.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";

const TAB_READY_MAX_MS = 10_000;
const TAB_READY_RETRY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function openPassiveProductTab(url: string): Promise<void> {
  await chrome.tabs.create({ url, active: false });
}

export async function waitForRetailerTabReady(tabId: number): Promise<boolean> {
  const deadline = Date.now() + TAB_READY_MAX_MS;

  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") {
        const response = (await chrome.tabs.sendMessage(tabId, {
          type: "RETAILER_PING",
        })) as { ok?: boolean } | undefined;
        if (response?.ok === true) {
          return true;
        }
      }
    } catch {
      // Content script may not be injected yet.
    }
    await sleep(TAB_READY_RETRY_MS);
  }

  return false;
}

export async function waitForTabComplete(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, TAB_READY_MAX_MS);

    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

export interface OpenRetailerWindowResult {
  opened: boolean;
  tabId: number | null;
  queued: boolean;
}

export async function openRetailerProductWindow(
  url: string,
  channelId: string,
  settings: ExtensionSettings,
  options: { startAuto: boolean },
): Promise<OpenRetailerWindowResult> {
  if (!isRetailerProductUrl(url) || !getRetailerAutoEnabled(settings, channelId)) {
    return { opened: false, tabId: null, queued: false };
  }

  if (!tryAcquireRetailerJob(channelId)) {
    await openPassiveProductTab(url);
    return { opened: false, tabId: null, queued: true };
  }

  const created = await chrome.windows.create({ url, focused: true });
  const tabId = created.tabs?.[0]?.id ?? null;
  const windowId = created.id ?? null;

  if (tabId === null) {
    releaseRetailerJob(channelId);
    return { opened: false, tabId: null, queued: false };
  }

  bindRetailerTab(tabId, channelId);
  if (windowId !== null) {
    registerRetailerWindow(windowId, tabId);
  }

  await waitForTabComplete(tabId);
  const ready = await waitForRetailerTabReady(tabId);

  if (options.startAuto && ready) {
    await chrome.tabs.sendMessage(tabId, {
      type: "RETAILER_START_AUTO",
      channel_id: channelId,
      url,
      source: "discord",
    });
  } else if (options.startAuto && !ready) {
    releaseRetailerJob(channelId);
  }

  return { opened: true, tabId, queued: false };
}

export function shouldOpenRetailerWindow(
  url: string,
  channelId: string,
  settings: ExtensionSettings,
): boolean {
  return isRetailerProductUrl(url) && getRetailerAutoEnabled(settings, channelId);
}
