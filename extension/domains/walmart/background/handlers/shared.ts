import {
  attachTabToRecording,
  listAllWalmartTabs,
  pickPrimaryTabId,
} from "@ext/domains/walmart/background/tabs.ts";
import {
  readMetrics,
  writeMetrics,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { getSession, updateSession } from "@ext/domains/walmart/lib/idb/session-store.ts";
import { appendEvents } from "@ext/domains/walmart/lib/idb/event-store.ts";
import type { EndpointCatalogEntry, WalmartRecordingEvent, WalmartSessionMeta } from "@ext/domains/walmart/types/walmart.ts";
import { onWalmartTabUpdated } from "@ext/domains/walmart/background/handlers/tab-events.ts";

export const endpointCatalogs = new Map<string, EndpointCatalogEntry[]>();
export const tabUrlById = new Map<number, string>();

let tabUpdateListenerRegistered = false;

export async function refreshMetrics(sessionId: string | null, recordingActive: boolean): Promise<void> {
  const current = await readMetrics();
  if (!sessionId) {
    await writeMetrics({ ...current, recordingActive: false, sessionId: null });
    return;
  }
  const meta = await getSession(sessionId);
  if (!meta) {
    await writeMetrics({ ...current, recordingActive: false, sessionId: null });
    return;
  }
  await writeMetrics({
    sessionId,
    eventCount: current.eventCount,
    bytes: meta.byteTotal,
    dropDate: meta.dropDate,
    recordingActive,
    startedAt: meta.startedAt,
  });
}

export function registerTabUpdateListener(): void {
  if (tabUpdateListenerRegistered) {
    return;
  }
  chrome.tabs.onUpdated.addListener(onWalmartTabUpdated);
  tabUpdateListenerRegistered = true;
}

export function unregisterTabUpdateListener(): void {
  if (!tabUpdateListenerRegistered) {
    return;
  }
  chrome.tabs.onUpdated.removeListener(onWalmartTabUpdated);
  tabUpdateListenerRegistered = false;
}

export async function appendTabLeave(sessionId: string, tabId: number, url: string): Promise<void> {
  const leaveEvent: WalmartRecordingEvent = {
    kind: "tab_leave",
    ts: new Date().toISOString(),
    tabId,
    url,
  };
  await appendEvents(sessionId, [leaveEvent]);
}

export function removeTabFromSessionMeta(meta: WalmartSessionMeta, tabId: number): void {
  meta.tabIds = meta.tabIds.filter((id) => id !== tabId);
  if (meta.primaryTabId === tabId) {
    meta.primaryTabId = null;
  }
}

export async function recordAttachSuccess(
  sessionId: string,
  tabId: number,
  tabUrl: string,
  joinMode: "primary" | "late",
): Promise<void> {
  tabUrlById.set(tabId, tabUrl);
  const meta = await getSession(sessionId);
  if (!meta) {
    return;
  }
  if (!meta.tabIds.includes(tabId)) {
    meta.tabIds.push(tabId);
  }
  meta.failedAttachTabIds = meta.failedAttachTabIds.filter((id) => id !== tabId);
  if (joinMode === "primary") {
    meta.primaryTabId = tabId;
    meta.tabId = tabId;
    meta.url = tabUrl;
  }
  await updateSession(meta);
}

export async function recordAttachFailure(sessionId: string, tabId: number): Promise<void> {
  const meta = await getSession(sessionId);
  if (!meta) {
    return;
  }
  if (!meta.failedAttachTabIds.includes(tabId)) {
    meta.failedAttachTabIds.push(tabId);
    await updateSession(meta);
  }
}

export async function attachExistingTabs(sessionId: string): Promise<{ attached: number; failed: number }> {
  const tabs = await listAllWalmartTabs();
  if (tabs.length === 0) {
    return { attached: 0, failed: 0 };
  }

  const primaryTabId = await pickPrimaryTabId(tabs);
  let attached = 0;
  let failed = 0;

  for (const tab of tabs) {
    if (tab.id == null || !tab.url) {
      continue;
    }
    const joinMode = tab.id === primaryTabId ? "primary" : "late";
    const result = await attachTabToRecording(tab.id, sessionId, {
      joinMode,
      tabUrl: tab.url,
    });
    if (result === "attached") {
      attached += 1;
      await recordAttachSuccess(sessionId, tab.id, tab.url, joinMode);
    } else {
      failed += 1;
      await recordAttachFailure(sessionId, tab.id);
    }
  }

  return { attached, failed };
}
