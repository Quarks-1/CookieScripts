import { downloadSessionZip } from "@ext/background/walmart-export.ts";
import { sendToActiveWalmartTab } from "@ext/background/walmart-tab-message.ts";
import {
  attachTabToRecording,
  broadcastToRecordingTabs,
  listAllWalmartTabs,
  pickPrimaryTabId,
} from "@ext/background/walmart-tabs.ts";
import {
  bindWalmartTab,
  getActiveRecordingSessionId,
  getWalmartTabSession,
  listRecordingTabIds,
  isWalmartTabRecording,
  readLastExport,
  readMetrics,
  releaseExport,
  loadWalmartRecordingState as restoreActiveSessionId,
  setActiveRecordingSessionId,
  setFlushAck,
  tryAcquireExport,
  unbindWalmartTab,
  waitForFlushAck,
  writeLastExport,
  writeMetrics,
} from "@ext/background/walmart-runtime-state.ts";
import { MAX_APPEND_CHUNK_BYTES, WALMART_PROBE_VERSION } from "@ext/lib/walmart/constants.ts";
import { splitAppendPayload } from "@ext/lib/walmart/append-chunks.ts";
import { shouldCatalogNetworkEvent } from "@ext/lib/walmart/catalog-filter.ts";
import { upsertEndpoint } from "@ext/lib/walmart/endpoint-index.ts";
import { appendEvents, hasSessionStartEvent } from "@ext/lib/walmart/idb/event-store.ts";
import { saveEndpoints } from "@ext/lib/walmart/idb/endpoints-store.ts";
import { appendPages } from "@ext/lib/walmart/idb/pages-store.ts";
import {
  createSession,
  deleteSession,
  getLastStoppedSession,
  getSession,
  updateSession,
} from "@ext/lib/walmart/idb/session-store.ts";
import { isWalmartUrl } from "@ext/lib/walmart/host.ts";
import { getSettings } from "@ext/lib/storage.ts";
import type {
  BackgroundResponse,
  UiToBackground,
  WalmartToBackground,
} from "@ext/types/index.ts";
import type { EndpointCatalogEntry, WalmartRecordingEvent, WalmartSessionMeta } from "@ext/types/walmart.ts";

const endpointCatalogs = new Map<string, EndpointCatalogEntry[]>();
const tabUrlById = new Map<number, string>();

let tabUpdateListenerRegistered = false;

async function refreshMetrics(sessionId: string | null, recordingActive: boolean): Promise<void> {
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

function registerTabUpdateListener(): void {
  if (tabUpdateListenerRegistered) {
    return;
  }
  chrome.tabs.onUpdated.addListener(onWalmartTabUpdated);
  tabUpdateListenerRegistered = true;
}

function unregisterTabUpdateListener(): void {
  if (!tabUpdateListenerRegistered) {
    return;
  }
  chrome.tabs.onUpdated.removeListener(onWalmartTabUpdated);
  tabUpdateListenerRegistered = false;
}

export function ensureWalmartTabUpdateListener(): void {
  if (getActiveRecordingSessionId()) {
    registerTabUpdateListener();
  }
}

async function appendTabLeave(sessionId: string, tabId: number, url: string): Promise<void> {
  const leaveEvent: WalmartRecordingEvent = {
    kind: "tab_leave",
    ts: new Date().toISOString(),
    tabId,
    url,
  };
  await appendEvents(sessionId, [leaveEvent]);
}

function removeTabFromSessionMeta(meta: WalmartSessionMeta, tabId: number): void {
  meta.tabIds = meta.tabIds.filter((id) => id !== tabId);
  if (meta.primaryTabId === tabId) {
    meta.primaryTabId = null;
  }
}

async function recordAttachSuccess(
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

async function recordAttachFailure(sessionId: string, tabId: number): Promise<void> {
  const meta = await getSession(sessionId);
  if (!meta) {
    return;
  }
  if (!meta.failedAttachTabIds.includes(tabId)) {
    meta.failedAttachTabIds.push(tabId);
    await updateSession(meta);
  }
}

async function attachExistingTabs(sessionId: string): Promise<{ attached: number; failed: number }> {
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

async function finalizeAndExport(sessionId: string): Promise<BackgroundResponse> {
  if (!tryAcquireExport(sessionId)) {
    const last = await readLastExport();
    if (last?.sessionId === sessionId) {
      return { ok: true, export: { downloadId: last.downloadId, filename: last.filename } };
    }
    return { ok: false, error: "Export already in progress" };
  }

  try {
    const meta = await getSession(sessionId);
    if (!meta) {
      return { ok: false, error: "Session not found" };
    }
    if (!meta.stoppedAt) {
      meta.stoppedAt = new Date().toISOString();
      await updateSession(meta);
    }
    const catalog = endpointCatalogs.get(sessionId) ?? [];
    if (catalog.length > 0) {
      await saveEndpoints(sessionId, catalog);
    }
    const exportInfo = await downloadSessionZip(sessionId);
    meta.exportedAt = exportInfo.exportedAt;
    await updateSession(meta);
    await writeLastExport(exportInfo);

    for (const tabId of listRecordingTabIds(sessionId)) {
      unbindWalmartTab(tabId);
      tabUrlById.delete(tabId);
    }
    endpointCatalogs.delete(sessionId);
    await refreshMetrics(null, false);
    return { ok: true, export: { downloadId: exportInfo.downloadId, filename: exportInfo.filename } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Export failed" };
  } finally {
    releaseExport(sessionId);
  }
}

export async function startWalmartRecording(): Promise<BackgroundResponse> {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { ok: false, error: "Extension is disabled" };
  }
  if (getActiveRecordingSessionId()) {
    return { ok: false, error: "Recording already active" };
  }

  const sessionId = crypto.randomUUID();
  const meta = await createSession({
    sessionId,
    tabId: 0,
    tabIds: [],
    primaryTabId: null,
    failedAttachTabIds: [],
    url: "",
    userAgent: navigator.userAgent,
    extensionVersion: chrome.runtime.getManifest().version,
    probeVersion: WALMART_PROBE_VERSION,
  });
  endpointCatalogs.set(sessionId, []);
  await setActiveRecordingSessionId(sessionId);

  await writeMetrics({
    sessionId,
    eventCount: 0,
    bytes: 0,
    dropDate: meta.dropDate,
    recordingActive: true,
    startedAt: meta.startedAt,
  });

  const walmartTabCount = (await listAllWalmartTabs()).length;
  const { attached, failed } = await attachExistingTabs(sessionId);

  if (walmartTabCount > 0 && attached === 0) {
    await deleteSession(sessionId);
    endpointCatalogs.delete(sessionId);
    await setActiveRecordingSessionId(null);
    await writeMetrics({
      sessionId: null,
      eventCount: 0,
      bytes: 0,
      dropDate: null,
      recordingActive: false,
      startedAt: null,
    });
    return { ok: false, error: "No Walmart tabs could be attached — refresh and try again" };
  }

  if (failed > 0) {
    const sessionMeta = await getSession(sessionId);
    if (sessionMeta) {
      await updateSession(sessionMeta);
    }
  }

  registerTabUpdateListener();
  return { ok: true };
}

export async function stopWalmartRecording(): Promise<BackgroundResponse> {
  const sessionId = getActiveRecordingSessionId();
  if (!sessionId) {
    return { ok: false, error: "No active recording" };
  }

  const [metrics, meta] = await Promise.all([readMetrics(), getSession(sessionId)]);
  await writeMetrics({
    sessionId,
    eventCount: metrics.eventCount,
    bytes: meta?.byteTotal ?? metrics.bytes,
    dropDate: meta?.dropDate ?? metrics.dropDate,
    recordingActive: false,
    startedAt: meta?.startedAt ?? metrics.startedAt,
  });

  await broadcastToRecordingTabs(sessionId, { type: "WALMART_RECORDING_STOP" });
  const tabIds = listRecordingTabIds(sessionId);
  await Promise.all(tabIds.map((id) => waitForFlushAck(id, 500)));

  const sessionMeta = await getSession(sessionId);
  const neverAttached =
    sessionMeta != null &&
    sessionMeta.tabIds.length === 0 &&
    !(await hasSessionStartEvent(sessionId));

  if (neverAttached) {
    await deleteSession(sessionId);
    endpointCatalogs.delete(sessionId);
    await setActiveRecordingSessionId(null);
    unregisterTabUpdateListener();
    await refreshMetrics(null, false);
    return { ok: true };
  }

  if (sessionMeta) {
    const stopEvent: WalmartRecordingEvent = {
      kind: "session_stop",
      ts: new Date().toISOString(),
      url: sessionMeta.url,
    };
    await appendEvents(sessionId, [stopEvent]);
    sessionMeta.stoppedAt = new Date().toISOString();
    await updateSession(sessionMeta);
  }

  await setActiveRecordingSessionId(null);
  unregisterTabUpdateListener();
  return finalizeAndExport(sessionId);
}

export async function onWalmartTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  const sessionId = getActiveRecordingSessionId();
  if (!sessionId) {
    return;
  }

  const tabUrl = tab.url ?? "";
  const urlChanged = changeInfo.url != null || tabUrl.length > 0;

  if (isWalmartTabRecording(tabId) && urlChanged && tabUrl && !isWalmartUrl(tabUrl)) {
    const lastUrl = tabUrlById.get(tabId) ?? tabUrl;
    await waitForFlushAck(tabId, 500);
    await appendTabLeave(sessionId, tabId, lastUrl);
    unbindWalmartTab(tabId);
    tabUrlById.delete(tabId);
    const meta = await getSession(sessionId);
    if (meta) {
      removeTabFromSessionMeta(meta, tabId);
      await updateSession(meta);
    }
    return;
  }

  if (changeInfo.status !== "complete") {
    return;
  }
  if (!tabUrl || !isWalmartUrl(tabUrl)) {
    return;
  }
  if (isWalmartTabRecording(tabId)) {
    return;
  }

  const meta = await getSession(sessionId);
  if (!meta) {
    return;
  }

  const joinMode = meta.primaryTabId === null ? "primary" : "late";
  const result = await attachTabToRecording(tabId, sessionId, { joinMode, tabUrl });
  if (result === "attached") {
    await recordAttachSuccess(sessionId, tabId, tabUrl, joinMode);
  } else {
    await recordAttachFailure(sessionId, tabId);
  }
}

async function applyAppendChunk(
  message: Extract<WalmartToBackground, { type: "WALMART_RECORDING_APPEND" }>,
): Promise<void> {
  if (message.events.length > 0) {
    await appendEvents(message.sessionId, message.events);
    let catalog = endpointCatalogs.get(message.sessionId) ?? [];
    for (const event of message.events) {
      if (event.kind === "network" && shouldCatalogNetworkEvent(event)) {
        const catalogUrl = event.absoluteUrl ?? event.url;
        catalog = upsertEndpoint(
          catalog,
          event.method,
          catalogUrl,
          event.ts,
          event.requestBody,
        );
      }
    }
    endpointCatalogs.set(message.sessionId, catalog);
  }
  if (message.pages && message.pages.length > 0) {
    await appendPages(message.sessionId, message.pages);
  }

  const meta = await getSession(message.sessionId);
  if (meta) {
    if (message.byteDelta) {
      meta.byteTotal += message.byteDelta;
    }
    if (message.droppedEvents) {
      meta.droppedEvents += message.droppedEvents;
    }
    if (message.truncated) {
      meta.truncated = true;
    }
    await updateSession(meta);
    const metrics = await readMetrics();
    await writeMetrics({
      ...metrics,
      eventCount: metrics.eventCount + message.events.length,
      bytes: meta.byteTotal,
      dropDate: meta.dropDate,
      recordingActive: true,
      startedAt: meta.startedAt,
      sessionId: message.sessionId,
    });
  }
}

export async function handleWalmartAppend(
  message: Extract<WalmartToBackground, { type: "WALMART_RECORDING_APPEND" }>,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    return { ok: false, error: "Unauthorized sender" };
  }
  const bound = getWalmartTabSession(tabId);
  if (bound !== message.sessionId) {
    return { ok: false, error: "Session mismatch" };
  }

  const chunks = splitAppendPayload({
    sessionId: message.sessionId,
    events: message.events,
    pages: message.pages,
    byteDelta: message.byteDelta,
    droppedEvents: message.droppedEvents,
    truncated: message.truncated,
  });

  let droppedWholeBatch = false;
  for (const chunk of chunks) {
    const payloadBytes = new TextEncoder().encode(JSON.stringify({ ...message, ...chunk })).length;
    if (payloadBytes > MAX_APPEND_CHUNK_BYTES) {
      const meta = await getSession(message.sessionId);
      if (meta) {
        meta.droppedEvents += chunk.events.length;
        meta.truncated = true;
        await updateSession(meta);
      }
      droppedWholeBatch = true;
      continue;
    }
    await applyAppendChunk({
      type: "WALMART_RECORDING_APPEND",
      sessionId: message.sessionId,
      events: chunk.events,
      pages: chunk.pages,
      byteDelta: chunk.byteDelta,
      droppedEvents: chunk.droppedEvents,
      truncated: chunk.truncated,
    });
  }

  return { ok: true, ack: true, dropped: droppedWholeBatch || undefined };
}

async function resolveSessionIdForClear(): Promise<string | null> {
  const active = getActiveRecordingSessionId();
  if (active) {
    return active;
  }
  const lastExport = await readLastExport();
  if (lastExport?.sessionId) {
    return lastExport.sessionId;
  }
  const lastStopped = await getLastStoppedSession();
  return lastStopped?.sessionId ?? null;
}

export async function handleWalmartUiMessage(
  message: Extract<UiToBackground, { type: "WALMART_RECORDING" }>,
): Promise<BackgroundResponse> {
  switch (message.action) {
    case "start":
      return startWalmartRecording();
    case "stop":
      return stopWalmartRecording();
    case "mark": {
      if (!message.label) {
        return { ok: false, error: "Marker label required" };
      }
      const result = await sendToActiveWalmartTab({
        type: "WALMART_RECORDING_MARK",
        label: message.label,
      });
      if (!result.ok) {
        return result;
      }
      return { ok: true };
    }
    case "clear": {
      if (getActiveRecordingSessionId()) {
        const stopResult = await stopWalmartRecording();
        if ("ok" in stopResult && stopResult.ok === false) {
          return stopResult;
        }
      }
      const sessionId = await resolveSessionIdForClear();
      if (!sessionId) {
        return { ok: false, error: "No session to clear" };
      }
      await deleteSession(sessionId);
      for (const tabId of listRecordingTabIds(sessionId)) {
        unbindWalmartTab(tabId);
        tabUrlById.delete(tabId);
      }
      endpointCatalogs.delete(sessionId);
      await setActiveRecordingSessionId(null);
      unregisterTabUpdateListener();
      await refreshMetrics(null, false);
      return { ok: true };
    }
    case "export": {
      if (getActiveRecordingSessionId()) {
        return { ok: false, error: "Stop recording first" };
      }
      const lastExport = await readLastExport();
      const lastStopped = await getLastStoppedSession();
      const sessionId = lastStopped?.sessionId ?? lastExport?.sessionId;
      if (!sessionId) {
        return { ok: false, error: "No session to export" };
      }
      return finalizeAndExport(sessionId);
    }
    default:
      return { ok: false, error: "Unknown action" };
  }
}

export async function handleWalmartContentMessage(
  message: WalmartToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    return { ok: false, error: "Unauthorized sender" };
  }

  switch (message.type) {
    case "WALMART_RECORDING_APPEND": {
      const resultPromise = handleWalmartAppend(message, sender);
      setFlushAck(tabId, resultPromise.then(() => undefined));
      return resultPromise;
    }
    case "WALMART_RECORDING_REATTACH": {
      const activeSessionId = getActiveRecordingSessionId();
      if (activeSessionId !== message.sessionId) {
        return { ok: false, error: "No active recording session" };
      }
      bindWalmartTab(tabId, message.sessionId);
      const meta = await getSession(message.sessionId);
      if (meta) {
        if (!meta.tabIds.includes(tabId)) {
          meta.tabIds.push(tabId);
          await updateSession(meta);
        }
        const metrics = await readMetrics();
        await writeMetrics({
          ...metrics,
          sessionId: message.sessionId,
          dropDate: meta.dropDate,
          recordingActive: true,
          startedAt: meta.startedAt,
          bytes: meta.byteTotal,
        });
      }
      if (sender.tab?.url) {
        tabUrlById.set(tabId, sender.tab.url);
      }
      return { ok: true, tabId };
    }
    case "WALMART_PING":
      return { ok: true };
    default:
      return { ok: false, error: "Unknown message" };
  }
}

export async function onWalmartTabRemoved(tabId: number): Promise<void> {
  const sessionId = getWalmartTabSession(tabId);
  if (!sessionId) {
    return;
  }

  await waitForFlushAck(tabId, 500);
  const lastUrl = tabUrlById.get(tabId) ?? "";
  await appendTabLeave(sessionId, tabId, lastUrl);
  unbindWalmartTab(tabId);
  tabUrlById.delete(tabId);

  const meta = await getSession(sessionId);
  if (meta) {
    removeTabFromSessionMeta(meta, tabId);
    await updateSession(meta);
  }

  if (listRecordingTabIds(sessionId).length > 0) {
    return;
  }

  if (meta && !meta.stoppedAt) {
    meta.stoppedAt = new Date().toISOString();
    await updateSession(meta);
  }

  await setActiveRecordingSessionId(null);
  unregisterTabUpdateListener();
  await finalizeAndExport(sessionId);
}

export async function stopAllWalmartRecordingsForDisable(): Promise<void> {
  if (getActiveRecordingSessionId()) {
    await stopWalmartRecording();
  }
}

export async function loadWalmartRecordingState(): Promise<void> {
  const sessionId = await restoreActiveSessionId();
  if (!sessionId) {
    return;
  }
  registerTabUpdateListener();
  const meta = await getSession(sessionId);
  if (meta) {
    const metrics = await readMetrics();
    if (!metrics.recordingActive) {
      await writeMetrics({
        ...metrics,
        sessionId,
        recordingActive: true,
        startedAt: meta.startedAt,
        bytes: meta.byteTotal,
        dropDate: meta.dropDate,
      });
    }
  }
}
