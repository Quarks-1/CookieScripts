import {
  bindSamsclubTab,
  getActiveRecordingSessionId,
  readMetrics,
  setFlushAck,
  writeMetrics,
} from "@ext/domains/samsclub/background/runtime-state.ts";
import { getSession, updateSession } from "@ext/domains/samsclub/lib/idb/session-store.ts";
import type { BackgroundResponse, SamsclubToBackground } from "@ext/core/types/index.ts";
import { tabUrlById } from "@ext/domains/samsclub/background/handlers/shared.ts";
import { handleSamsclubAppend } from "@ext/domains/samsclub/background/handlers/append.ts";
import { handleSamsclubAutomationMessage } from "@ext/domains/samsclub/background/handlers/automation-messages.ts";

const AUTOMATION_MESSAGE_TYPES = new Set<SamsclubToBackground["type"]>([
  "SAMSCLUB_PING",
  "SAMSCLUB_AUTO_STATUS",
  "SAMSCLUB_GET_AUTO_CONFIG",
  "SAMSCLUB_SET_REFRESH_INTERVAL",
  "SAMSCLUB_HARD_RELOAD",
  "SAMSCLUB_GET_TAB_AUTO_STATE",
  "SAMSCLUB_SYNC_MANUAL_STOP",
  "SAMSCLUB_SYNC_MANUAL_START",
  "SAMSCLUB_UI_STATE",
  "SAMSCLUB_PURCHASE_LIMIT_SNAPSHOT",
]);

export async function handleSamsclubContentMessage(
  message: SamsclubToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  if (AUTOMATION_MESSAGE_TYPES.has(message.type)) {
    return handleSamsclubAutomationMessage(message, sender);
  }

  const tabId = sender.tab?.id;
  if (tabId == null) {
    return { ok: false, error: "Unauthorized sender" };
  }

  switch (message.type) {
    case "SAMSCLUB_RECORDING_APPEND": {
      const resultPromise = handleSamsclubAppend(message, sender);
      setFlushAck(tabId, resultPromise.then(() => undefined));
      return resultPromise;
    }
    case "SAMSCLUB_RECORDING_REATTACH": {
      const activeSessionId = getActiveRecordingSessionId();
      if (activeSessionId !== message.sessionId) {
        return { ok: false, error: "No active recording session" };
      }
      bindSamsclubTab(tabId, message.sessionId);
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
    default:
      return { ok: false, error: "Unknown message" };
  }
}
