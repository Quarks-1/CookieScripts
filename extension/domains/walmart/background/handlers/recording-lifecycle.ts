import { downloadSessionZip } from "@ext/domains/walmart/background/export.ts";
import { broadcastToRecordingTabs, listAllWalmartTabs } from "@ext/domains/walmart/background/tabs.ts";
import {
  getActiveRecordingSessionId,
  listRecordingTabIds,
  readLastExport,
  readMetrics,
  releaseExport,
  loadWalmartRecordingState as restoreActiveSessionId,
  setActiveRecordingSessionId,
  tryAcquireExport,
  unbindWalmartTab,
  waitForFlushAck,
  writeLastExport,
  writeMetrics,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { WALMART_PROBE_VERSION } from "@ext/domains/walmart/lib/constants.ts";
import { appendEvents, hasSessionStartEvent } from "@ext/domains/walmart/lib/idb/event-store.ts";
import { saveEndpoints } from "@ext/domains/walmart/lib/idb/endpoints-store.ts";
import {
  createSession,
  deleteSession,
  getSession,
  updateSession,
} from "@ext/domains/walmart/lib/idb/session-store.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import type { BackgroundResponse } from "@ext/core/types/index.ts";
import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";
import {
  attachExistingTabs,
  endpointCatalogs,
  refreshMetrics,
  registerTabUpdateListener,
  tabUrlById,
  unregisterTabUpdateListener,
} from "@ext/domains/walmart/background/handlers/shared.ts";

export async function finalizeAndExport(sessionId: string): Promise<BackgroundResponse> {
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
