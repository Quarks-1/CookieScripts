/**
 * Samsclub automation runtime state:
 * 1. tabChannelMap binds samsclub tab IDs to Discord channel_id for status validation
 * 2. Cleanup on tab/window removal clears tab bindings and UI state
 */

import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";

const tabChannelMap = new Map<number, string>();
const windowTabMap = new Map<number, number>();

export type SamsclubTabUiState = {
  status: string;
  running: boolean;
};

const tabUiState = new Map<number, SamsclubTabUiState>();
type TabPurchaseLimitEntry = {
  url: string;
  purchaseLimit: number | null;
};
const tabPurchaseLimits = new Map<number, TabPurchaseLimitEntry>();
const manualAutoStoppedTabs = new Set<number>();

/** Strip hash so SPA navigations with tracking fragments still match. */
export function normalizeSamsclubTabUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url.split("#")[0] ?? url;
  }
}

const DEFAULT_TAB_UI_STATE: SamsclubTabUiState = {
  status: "Ready — open a product page and press Start",
  running: false,
};

export function bindSamsclubTab(tabId: number, channelId: string): void {
  tabChannelMap.set(tabId, channelId);
}

export function getSamsclubTabChannel(tabId: number): string | undefined {
  return tabChannelMap.get(tabId);
}

export function registerSamsclubWindow(windowId: number, tabId: number): void {
  windowTabMap.set(windowId, tabId);
}

export function onSamsclubTabRemoved(tabId: number): void {
  tabChannelMap.delete(tabId);
  tabUiState.delete(tabId);
  tabPurchaseLimits.delete(tabId);
  manualAutoStoppedTabs.delete(tabId);
  for (const [windowId, mappedTabId] of windowTabMap.entries()) {
    if (mappedTabId === tabId) {
      windowTabMap.delete(windowId);
    }
  }
}

export function onSamsclubWindowRemoved(windowId: number): void {
  const tabId = windowTabMap.get(windowId);
  if (tabId !== undefined) {
    onSamsclubTabRemoved(tabId);
  }
  windowTabMap.delete(windowId);
}

export async function broadcastSamsclubStopAuto(channelId?: string): Promise<void> {
  for (const [tabId, boundChannel] of tabChannelMap.entries()) {
    if (channelId && boundChannel !== channelId) {
      continue;
    }
    await stopSamsclubTabAuto(tabId);
  }
}

export function markSamsclubManualAutoStopped(tabId: number): void {
  const wasRunning = getSamsclubTabUiState(tabId).running;
  manualAutoStoppedTabs.add(tabId);
  setSamsclubTabUiState(tabId, { status: "Stopped", running: false });
  if (wasRunning) {
    void notifyStatusChanged();
  }
}

export function clearSamsclubManualAutoStopped(tabId: number): void {
  manualAutoStoppedTabs.delete(tabId);
  const current = tabUiState.get(tabId);
  if (current && !current.running && current.status === "Stopped") {
    tabUiState.delete(tabId);
  }
}

export function isSamsclubManualAutoStopped(tabId: number): boolean {
  return manualAutoStoppedTabs.has(tabId);
}

export async function stopSamsclubTabAuto(tabId: number): Promise<void> {
  markSamsclubManualAutoStopped(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { type: "SAMSCLUB_STOP_AUTO" });
  } catch {
    // Tab may be reloading — the service worker stop flag still applies.
  }
}

export function clearSamsclubRuntimeState(): void {
  tabChannelMap.clear();
  windowTabMap.clear();
  tabUiState.clear();
  tabPurchaseLimits.clear();
  manualAutoStoppedTabs.clear();
}

export function setSamsclubTabPurchaseLimit(
  tabId: number,
  tabUrl: string,
  purchaseLimit: number | null,
): void {
  tabPurchaseLimits.set(tabId, {
    url: normalizeSamsclubTabUrl(tabUrl),
    purchaseLimit,
  });
}

export function getSamsclubTabPurchaseLimit(
  tabId: number,
  tabUrl?: string,
): number | null | undefined {
  const entry = tabPurchaseLimits.get(tabId);
  if (!entry) {
    return undefined;
  }
  if (tabUrl != null && entry.url !== normalizeSamsclubTabUrl(tabUrl)) {
    return undefined;
  }
  return entry.purchaseLimit;
}

export function setSamsclubTabUiState(tabId: number, state: SamsclubTabUiState): void {
  const before = getSamsclubTabUiState(tabId).running;
  tabUiState.set(tabId, state);
  const after = getSamsclubTabUiState(tabId).running;
  if (before !== after) {
    void notifyStatusChanged();
  }
}

export function getSamsclubTabUiState(tabId: number): SamsclubTabUiState {
  if (isSamsclubManualAutoStopped(tabId)) {
    return { status: "Stopped", running: false };
  }
  return tabUiState.get(tabId) ?? DEFAULT_TAB_UI_STATE;
}
