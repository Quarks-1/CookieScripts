/**
 * Retailer automation runtime state:
 * 1. tabChannelMap binds retailer tab IDs to Discord channel_id for status validation
 * 2. Cleanup on tab/window removal clears tab bindings and UI state
 */

import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";

const tabChannelMap = new Map<number, string>();
const windowTabMap = new Map<number, number>();

export type RetailerTabUiState = {
  status: string;
  running: boolean;
};

const tabUiState = new Map<number, RetailerTabUiState>();
type TabPurchaseLimitEntry = {
  url: string;
  purchaseLimit: number | null;
};
const tabPurchaseLimits = new Map<number, TabPurchaseLimitEntry>();
const manualAutoStoppedTabs = new Set<number>();

/** Strip hash so SPA navigations with tracking fragments still match. */
export function normalizeRetailerTabUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url.split("#")[0] ?? url;
  }
}

const DEFAULT_TAB_UI_STATE: RetailerTabUiState = {
  status: "Ready — open a product page and press Start",
  running: false,
};

export function bindRetailerTab(tabId: number, channelId: string): void {
  tabChannelMap.set(tabId, channelId);
}

export function getRetailerTabChannel(tabId: number): string | undefined {
  return tabChannelMap.get(tabId);
}

export function registerRetailerWindow(windowId: number, tabId: number): void {
  windowTabMap.set(windowId, tabId);
}

export function onRetailerTabRemoved(tabId: number): void {
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

export function onRetailerWindowRemoved(windowId: number): void {
  const tabId = windowTabMap.get(windowId);
  if (tabId !== undefined) {
    onRetailerTabRemoved(tabId);
  }
  windowTabMap.delete(windowId);
}

export async function broadcastRetailerStopAuto(channelId?: string): Promise<void> {
  for (const [tabId, boundChannel] of tabChannelMap.entries()) {
    if (channelId && boundChannel !== channelId) {
      continue;
    }
    await stopRetailerTabAuto(tabId);
  }
}

export function markRetailerManualAutoStopped(tabId: number): void {
  const wasRunning = getRetailerTabUiState(tabId).running;
  manualAutoStoppedTabs.add(tabId);
  setRetailerTabUiState(tabId, { status: "Stopped", running: false });
  if (wasRunning) {
    void notifyStatusChanged();
  }
}

export function clearRetailerManualAutoStopped(tabId: number): void {
  manualAutoStoppedTabs.delete(tabId);
  const current = tabUiState.get(tabId);
  if (current && !current.running && current.status === "Stopped") {
    tabUiState.delete(tabId);
  }
}

export function isRetailerManualAutoStopped(tabId: number): boolean {
  return manualAutoStoppedTabs.has(tabId);
}

export async function stopRetailerTabAuto(tabId: number): Promise<void> {
  markRetailerManualAutoStopped(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { type: "RETAILER_STOP_AUTO" });
  } catch {
    // Tab may be reloading — the service worker stop flag still applies.
  }
}

export function clearRetailerRuntimeState(): void {
  tabChannelMap.clear();
  windowTabMap.clear();
  tabUiState.clear();
  tabPurchaseLimits.clear();
  manualAutoStoppedTabs.clear();
}

export function setRetailerTabPurchaseLimit(
  tabId: number,
  tabUrl: string,
  purchaseLimit: number | null,
): void {
  tabPurchaseLimits.set(tabId, {
    url: normalizeRetailerTabUrl(tabUrl),
    purchaseLimit,
  });
}

export function getRetailerTabPurchaseLimit(
  tabId: number,
  tabUrl?: string,
): number | null | undefined {
  const entry = tabPurchaseLimits.get(tabId);
  if (!entry) {
    return undefined;
  }
  if (tabUrl != null && entry.url !== normalizeRetailerTabUrl(tabUrl)) {
    return undefined;
  }
  return entry.purchaseLimit;
}

export function setRetailerTabUiState(tabId: number, state: RetailerTabUiState): void {
  const before = getRetailerTabUiState(tabId).running;
  tabUiState.set(tabId, state);
  const after = getRetailerTabUiState(tabId).running;
  if (before !== after) {
    void notifyStatusChanged();
  }
}

export function getRetailerTabUiState(tabId: number): RetailerTabUiState {
  if (isRetailerManualAutoStopped(tabId)) {
    return { status: "Stopped", running: false };
  }
  return tabUiState.get(tabId) ?? DEFAULT_TAB_UI_STATE;
}
