import { sendToActiveSamsclubTab } from "@ext/domains/samsclub/background/tab-message.ts";
import {
  getActiveRecordingSessionId,
  listRecordingTabIds,
  readLastExport,
  setActiveRecordingSessionId,
  unbindSamsclubTab,
} from "@ext/domains/samsclub/background/runtime-state.ts";
import { deleteSession, getLastStoppedSession } from "@ext/domains/samsclub/lib/idb/session-store.ts";
import type { BackgroundResponse, UiToBackground } from "@ext/core/types/index.ts";
import {
  endpointCatalogs,
  refreshMetrics,
  tabUrlById,
  unregisterTabUpdateListener,
} from "@ext/domains/samsclub/background/handlers/shared.ts";
import {
  finalizeAndExport,
  startSamsclubRecording,
  stopSamsclubRecording,
} from "@ext/domains/samsclub/background/handlers/recording-lifecycle.ts";

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

export async function handleSamsclubUiMessage(
  message: Extract<UiToBackground, { type: "SAMSCLUB_RECORDING" }>,
): Promise<BackgroundResponse> {
  switch (message.action) {
    case "start":
      return startSamsclubRecording();
    case "stop":
      return stopSamsclubRecording();
    case "mark": {
      if (!message.label) {
        return { ok: false, error: "Marker label required" };
      }
      const result = await sendToActiveSamsclubTab({
        type: "SAMSCLUB_RECORDING_MARK",
        label: message.label,
      });
      if (!result.ok) {
        return result;
      }
      return { ok: true };
    }
    case "clear": {
      if (getActiveRecordingSessionId()) {
        const stopResult = await stopSamsclubRecording();
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
        unbindSamsclubTab(tabId);
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
