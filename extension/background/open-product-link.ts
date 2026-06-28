import {
  bindRetailerTab,
  onRetailerTabRemoved,
  registerRetailerWindow,
  releaseRetailerJob,
  tryAcquireRetailerJob,
} from "@ext/background/retailer-runtime-state.ts";
import { waitForRetailerTabReady } from "@ext/background/retailer-tab-ready.ts";
import { getRetailerAutoEnabled } from "@ext/lib/retailer/channel-config.ts";
import { isRetailerProductUrl } from "@ext/lib/retailer/host.ts";
import { sleep } from "@ext/lib/sleep.ts";
import { prependHistory } from "@ext/lib/storage.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";

export { waitForRetailerTabReady } from "@ext/background/retailer-tab-ready.ts";

const TAB_READY_MAX_MS = 10_000;
const START_AUTO_DELAY_MS = 2_000;
const START_AUTO_SEND_RETRIES = 3;
const START_AUTO_SEND_RETRY_MS = 500;

export async function openPassiveProductTab(url: string): Promise<void> {
  await chrome.tabs.create({ url, active: false });
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

async function sendRetailerStartAuto(
  tabId: number,
  channelId: string,
  url: string,
): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "RETAILER_START_AUTO",
      channel_id: channelId,
      url,
      source: "discord",
    });
    return true;
  } catch {
    return false;
  }
}

async function sendRetailerStartAutoWithRetries(
  tabId: number,
  channelId: string,
  url: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < START_AUTO_SEND_RETRIES; attempt++) {
    if (await sendRetailerStartAuto(tabId, channelId, url)) {
      return true;
    }
    if (attempt < START_AUTO_SEND_RETRIES - 1) {
      await sleep(START_AUTO_SEND_RETRY_MS);
    }
  }
  return false;
}

async function recordRetailerAutoStartFailure(channelId: string, url: string): Promise<void> {
  await prependHistory([
    {
      kind: "retailer_auto_failed",
      url,
      author: "retailer-auto",
      channel_id: channelId,
      timestamp: new Date().toISOString(),
      error: "Automation failed to start",
    },
  ]);
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
  let ready = await waitForRetailerTabReady(tabId);

  if (options.startAuto) {
    if (!ready) {
      await sleep(START_AUTO_DELAY_MS);
      await waitForRetailerTabReady(tabId);
    }

    const sent = await sendRetailerStartAutoWithRetries(tabId, channelId, url);
    if (!sent) {
      await recordRetailerAutoStartFailure(channelId, url);
      onRetailerTabRemoved(tabId);
      if (windowId !== null) {
        try {
          await chrome.windows.remove(windowId);
        } catch {
          // Window may already be closed.
        }
      }
    }
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
