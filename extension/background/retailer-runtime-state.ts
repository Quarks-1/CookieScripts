/**
 * Retailer automation runtime state:
 * 1. activeJobs tracks in-flight automation per channel (max 1)
 * 2. tabChannelMap binds retailer tab IDs to Discord channel_id for status validation
 * 3. Cleanup on tab/window removal releases concurrency slots
 */

const activeJobs = new Set<string>();
const tabChannelMap = new Map<number, string>();
const windowTabMap = new Map<number, number>();

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

export function clearRetailerRuntimeState(): void {
  activeJobs.clear();
  tabChannelMap.clear();
  windowTabMap.clear();
}
