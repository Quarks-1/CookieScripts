import {
  bindRetailerTab,
  onRetailerTabRemoved,
  registerRetailerWindow,
  setRetailerTabUiState,
} from "@ext/domains/target/background/runtime-state.ts";
import {
  getRetailerAtcQuantity,
  getRetailerAutoAtcEnabled,
  getRetailerAutoCheckoutEnabled,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerLinkOpenCount,
  getRetailerRefreshIntervalSec,
  getRetailerUseMaxQuantity,
} from "@ext/domains/target/lib/channel-config.ts";
import { isRetailerProductUrl } from "@ext/domains/target/lib/host.ts";
import { sleep } from "@ext/core/lib/sleep.ts";
import type { ExtensionSettings, HistoryItem } from "@ext/core/types/index.ts";

export { waitForRetailerTabReady } from "@ext/domains/target/background/tab-ready.ts";

const TAB_READY_MAX_MS = 10_000;
const START_AUTO_SEND_RETRIES = 40;
const START_AUTO_SEND_RETRY_MS = 50;

interface ChromeOpenResult {
  tabId: number | null;
  windowId: number | null;
}

async function createChromeOpen(
  url: string,
  options: { inWindow: boolean; focused?: boolean },
): Promise<ChromeOpenResult> {
  if (options.inWindow) {
    const created = await chrome.windows.create({ url, focused: options.focused ?? false });
    return {
      tabId: created.tabs?.[0]?.id ?? null,
      windowId: created.id ?? null,
    };
  }

  const tab = await chrome.tabs.create({ url, active: false });
  return { tabId: tab.id ?? null, windowId: null };
}

export async function openPassiveProductLink(
  url: string,
  options: { inWindow: boolean; focused?: boolean },
): Promise<void> {
  await createChromeOpen(url, options);
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

function buildRetailerAutoStartFailureHistory(
  channelId: string,
  url: string,
  timestamp: string,
): HistoryItem {
  return {
    kind: "retailer_auto_failed",
    url,
    author: "retailer-auto",
    channel_id: channelId,
    timestamp,
    error: "Automation failed to start",
  };
}

interface TargetIterationResult {
  opened: boolean;
  history?: HistoryItem;
}

async function openTargetIteration(
  url: string,
  channelId: string,
  settings: ExtensionSettings,
  options: { startAuto: boolean; inWindow: boolean; author: string; timestamp: string },
): Promise<TargetIterationResult> {
  if (options.startAuto) {
    const { tabId, windowId } = await createChromeOpen(url, { inWindow: true, focused: true });

    if (tabId === null) {
      return { opened: false };
    }

    bindRetailerTab(tabId, channelId);
    if (windowId !== null) {
      registerRetailerWindow(windowId, tabId);
    }

    setRetailerTabUiState(tabId, { status: "Starting auto mode…", running: true });
    const sent = await sendRetailerStartAutoWithRetries(tabId, channelId, url, settings);
    if (!sent) {
      onRetailerTabRemoved(tabId);
      if (windowId !== null) {
        try {
          await chrome.windows.remove(windowId);
        } catch {
          // Window may already be closed.
        }
      }
      return {
        opened: false,
        history: buildRetailerAutoStartFailureHistory(channelId, url, options.timestamp),
      };
    }

    return {
      opened: true,
      history: {
        kind: "retailer_window_opened",
        url,
        author: options.author,
        channel_id: channelId,
        timestamp: options.timestamp,
      },
    };
  }

  try {
    await createChromeOpen(url, { inWindow: options.inWindow, focused: options.inWindow });
  } catch {
    return { opened: false };
  }

  return {
    opened: true,
    history: {
      kind: "opened",
      url,
      author: options.author,
      channel_id: channelId,
      timestamp: options.timestamp,
    },
  };
}

export async function openTargetLinkRepeated(
  url: string,
  channelId: string,
  settings: ExtensionSettings,
  options: { inWindow: boolean; author: string; timestamp: string },
): Promise<{ opened: string[]; histories: HistoryItem[] }> {
  if (!isRetailerProductUrl(url)) {
    await openPassiveProductLink(url, { inWindow: options.inWindow });
    return {
      opened: [url],
      histories: [
        {
          kind: "opened",
          url,
          author: options.author,
          channel_id: channelId,
          timestamp: options.timestamp,
        },
      ],
    };
  }

  const count = getRetailerLinkOpenCount(settings);
  const startAuto = getRetailerAutoAtcEnabled(settings, channelId);
  const opened: string[] = [];
  const histories: HistoryItem[] = [];

  for (let i = 0; i < count; i++) {
    const result = await openTargetIteration(url, channelId, settings, {
      startAuto,
      inWindow: options.inWindow,
      author: options.author,
      timestamp: options.timestamp,
    });
    if (result.opened) {
      opened.push(url);
    }
    if (result.history) {
      histories.push(result.history);
    }
  }

  return { opened, histories };
}
