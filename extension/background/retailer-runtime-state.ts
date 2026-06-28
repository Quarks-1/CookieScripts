/**
 * Retailer automation runtime state:
 * 1. activeJobs tracks in-flight automation per channel (max 1)
 * 2. tabChannelMap binds retailer tab IDs to Discord channel_id for status validation
 * 3. Cleanup on tab/window removal releases concurrency slots
 */

const activeJobs = new Set<string>();
const tabChannelMap = new Map<number, string>();
const windowTabMap = new Map<number, number>();

export type RetailerTabUiState = {
  status: string;
  running: boolean;
  recording: boolean;
};

const tabUiState = new Map<number, RetailerTabUiState>();

const DEFAULT_TAB_UI_STATE: RetailerTabUiState = {
  status: "Ready — open a product page and press Start",
  running: false,
  recording: false,
};

export function tryAcquireRetailerJob(channelId: string): boolean {
  if (activeJobs.has(channelId)) {
    return false;
  }
  activeJobs.add(channelId);
  return true;
}

export function releaseRetailerJob(channelId: string): void {
  activeJobs.delete(channelId);
}

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
  const channelId = tabChannelMap.get(tabId);
  if (channelId) {
    releaseRetailerJob(channelId);
  }
  tabChannelMap.delete(tabId);
  tabUiState.delete(tabId);
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
    try {
      await chrome.tabs.sendMessage(tabId, { type: "RETAILER_STOP_AUTO" });
    } catch {
      // Tab may have navigated away or closed.
    }
  }
}

export function clearRetailerRuntimeState(): void {
  activeJobs.clear();
  tabChannelMap.clear();
  windowTabMap.clear();
  tabUiState.clear();
}

export function setRetailerTabUiState(tabId: number, state: RetailerTabUiState): void {
  tabUiState.set(tabId, state);
}

export function getRetailerTabUiState(tabId: number): RetailerTabUiState {
  return tabUiState.get(tabId) ?? DEFAULT_TAB_UI_STATE;
}
