import {
  bindRetailerTab,
  onRetailerTabRemoved,
  registerRetailerWindow,
  releaseRetailerJob,
  setRetailerTabUiState,
  tryAcquireRetailerJob,
} from "@ext/domains/target/background/runtime-state.ts";
import {
  getRetailerAtcQuantity,
  getRetailerAutoAtcEnabled,
  getRetailerAutoCheckoutEnabled,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerRefreshIntervalSec,
  getRetailerUseMaxQuantity,
} from "@ext/domains/target/lib/channel-config.ts";
import { isRetailerProductUrl } from "@ext/domains/target/lib/host.ts";
import { sleep } from "@ext/core/lib/sleep.ts";
import { prependHistory } from "@ext/core/lib/storage.ts";
import type { ExtensionSettings } from "@ext/core/types/index.ts";

export { waitForRetailerTabReady } from "@ext/domains/target/background/tab-ready.ts";

const TAB_READY_MAX_MS = 10_000;
const START_AUTO_SEND_RETRIES = 40;
const START_AUTO_SEND_RETRY_MS = 50;

export async function openPassiveProductLink(
  url: string,
  options: { inWindow: boolean },
): Promise<void> {
  if (options.inWindow) {
    await chrome.windows.create({ url, focused: false });
  } else {
    await chrome.tabs.create({ url, active: false });
  }
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
  settings: ExtensionSettings,
): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "RETAILER_START_AUTO",
      channel_id: channelId,
      url,
      source: "discord",
      refresh_interval_sec: getRetailerRefreshIntervalSec(settings, channelId),
      frontend_atc_enabled: getRetailerFrontendAtcEnabled(settings),
      backend_atc_enabled: getRetailerBackendAtcEnabled(settings),
      atc_quantity: getRetailerAtcQuantity(settings),
      use_max_quantity: getRetailerUseMaxQuantity(settings),
      auto_checkout_enabled: getRetailerAutoCheckoutEnabled(settings),
    });
    setRetailerTabUiState(tabId, { status: "Running auto mode…", running: true });
    return true;
  } catch {
    return false;
  }
}

async function sendRetailerStartAutoWithRetries(
  tabId: number,
  channelId: string,
  url: string,
  settings: ExtensionSettings,
): Promise<boolean> {
  for (let attempt = 0; attempt < START_AUTO_SEND_RETRIES; attempt++) {
    if (await sendRetailerStartAuto(tabId, channelId, url, settings)) {
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
  if (!isRetailerProductUrl(url) || !getRetailerAutoAtcEnabled(settings, channelId)) {
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

  if (options.startAuto) {
    setRetailerTabUiState(tabId, { status: "Starting auto mode…", running: true });
    const sent = await sendRetailerStartAutoWithRetries(tabId, channelId, url, settings);
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
  return isRetailerProductUrl(url) && getRetailerAutoAtcEnabled(settings, channelId);
}
