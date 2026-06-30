import { getSettings } from "@ext/core/lib/storage.ts";
import {
  clearAllWalmartTabAutoRefresh,
  getWalmartTabAutoRefresh,
  hasWalmartTabAutoRefresh,
  listWalmartTabAutoRefreshTabIds,
  setWalmartTabAutoRefresh,
  type WalmartTabAutoRefreshState,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { getActiveWalmartTabInWindow } from "@ext/domains/walmart/background/tab-message.ts";
import {
  WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  normalizeWalmartRefreshIntervalSec,
} from "@ext/domains/walmart/lib/auto-refresh.ts";
import type {
  BackgroundResponse,
  BackgroundToContent,
  UiToBackground,
  WalmartToBackground,
} from "@ext/core/types/index.ts";

export function defaultWalmartAutoRefreshState(): WalmartTabAutoRefreshState {
  return {
    enabled: false,
    interval_sec: WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  };
}

export function resolveWalmartAutoRefreshForTab(
  tabId: number,
  extensionEnabled: boolean,
): { enabled: boolean; interval_sec: number; pause: boolean } {
  if (!extensionEnabled) {
    return {
      enabled: false,
      interval_sec: WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
      pause: false,
    };
  }
  const entry = getWalmartTabAutoRefresh(tabId);
  if (!entry) {
    return {
      enabled: false,
      interval_sec: WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
      pause: false,
    };
  }
  return {
    enabled: entry.enabled,
    interval_sec: entry.interval_sec,
    // Recording reattaches after hard reload via WALMART_RECORDING_REATTACH.
    pause: false,
  };
}

export async function stopAllWalmartAutoRefreshForDisable(): Promise<void> {
  const tabIds = listWalmartTabAutoRefreshTabIds();
  for (const tabId of tabIds) {
    await pushWalmartAutoRefreshConfigToTab(tabId, {
      enabled: false,
      interval_sec: WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
      pause: false,
    });
  }
  clearAllWalmartTabAutoRefresh();
}

export async function pushWalmartAutoRefreshConfigToTab(
  tabId: number,
  config: { enabled: boolean; interval_sec: number; pause: boolean },
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "WALMART_AUTO_REFRESH_CONFIG",
      ...config,
    } satisfies BackgroundToContent);
  } catch {
    // Tab may have navigated away or content not ready.
  }
}

export async function handleWalmartAutoRefreshContentMessage(
  message: Extract<
    WalmartToBackground,
    | { type: "WALMART_GET_AUTO_REFRESH_CONFIG" }
    | { type: "WALMART_SYNC_AUTO_REFRESH" }
    | { type: "WALMART_HARD_RELOAD" }
  >,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    return { ok: false, error: "Unauthorized sender" };
  }

  switch (message.type) {
    case "WALMART_GET_AUTO_REFRESH_CONFIG": {
      const settings = await getSettings();
      const config = resolveWalmartAutoRefreshForTab(tabId, settings.enabled);
      return { ok: true, ...config };
    }
    case "WALMART_SYNC_AUTO_REFRESH": {
      if (!hasWalmartTabAutoRefresh(tabId)) {
        setWalmartTabAutoRefresh(tabId, {
          enabled: message.enabled,
          interval_sec: normalizeWalmartRefreshIntervalSec(message.interval_sec),
          last_refresh_at: message.last_refresh_at,
        });
      }
      return { ok: true };
    }
    case "WALMART_HARD_RELOAD": {
      const existing = getWalmartTabAutoRefresh(tabId);
      if (existing) {
        setWalmartTabAutoRefresh(tabId, {
          ...existing,
          last_refresh_at: Date.now(),
        });
      }
      await chrome.tabs.reload(tabId, { bypassCache: true });
      return { ok: true };
    }
    default:
      return { ok: false, error: "Unknown message" };
  }
}

async function resolveUiWalmartTab(
  windowId?: number,
): Promise<chrome.tabs.Tab | null> {
  return getActiveWalmartTabInWindow(windowId);
}

export async function handleSetWalmartAutoRefreshEnabled(
  message: Extract<UiToBackground, { type: "SET_WALMART_AUTO_REFRESH_ENABLED" }>,
): Promise<BackgroundResponse> {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { ok: false, error: "Enable the extension first" };
  }

  const tab = await resolveUiWalmartTab(message.window_id);
  if (!tab?.id) {
    return { ok: false, error: "Open a Walmart tab in this window" };
  }

  const tabId = tab.id;
  const existing = getWalmartTabAutoRefresh(tabId) ?? defaultWalmartAutoRefreshState();

  if (message.enabled && existing.interval_sec < 1) {
    return { ok: false, error: "Set interval to at least 1 second" };
  }

  const next: WalmartTabAutoRefreshState = {
    ...existing,
    enabled: message.enabled,
    last_refresh_at: message.enabled ? Date.now() : existing.last_refresh_at,
  };
  setWalmartTabAutoRefresh(tabId, next);

  const config = resolveWalmartAutoRefreshForTab(tabId, settings.enabled);
  await pushWalmartAutoRefreshConfigToTab(tabId, config);
  return { ok: true };
}

export async function handleSetWalmartRefreshInterval(
  message: Extract<UiToBackground, { type: "SET_WALMART_REFRESH_INTERVAL" }>,
): Promise<BackgroundResponse> {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { ok: false, error: "Enable the extension first" };
  }

  const tab = await resolveUiWalmartTab(message.window_id);
  if (!tab?.id) {
    return { ok: false, error: "Open a Walmart tab in this window" };
  }

  const tabId = tab.id;
  const intervalSec = normalizeWalmartRefreshIntervalSec(message.interval_sec);
  const existing = getWalmartTabAutoRefresh(tabId);
  const intervalChanged = existing?.interval_sec !== intervalSec;
  const next: WalmartTabAutoRefreshState = {
    ...(existing ?? defaultWalmartAutoRefreshState()),
    interval_sec: intervalSec,
    last_refresh_at: intervalChanged ? Date.now() : existing?.last_refresh_at,
  };
  setWalmartTabAutoRefresh(tabId, next);

  const config = resolveWalmartAutoRefreshForTab(tabId, settings.enabled);
  await pushWalmartAutoRefreshConfigToTab(tabId, config);
  return { ok: true };
}
