import {
  bindWalmartTab,
  getActiveRecordingSessionId,
  readMetrics,
  setFlushAck,
  writeMetrics,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { getSession, updateSession } from "@ext/domains/walmart/lib/idb/session-store.ts";
import type { BackgroundResponse, WalmartToBackground } from "@ext/core/types/index.ts";
import { tabUrlById } from "@ext/domains/walmart/background/handlers/shared.ts";
import { handleWalmartAppend } from "@ext/domains/walmart/background/handlers/append.ts";
import { handleWalmartAutoRefreshContentMessage } from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import {
  handleWalmartQueuePass,
  handleWalmartQueueTabConsolidateRequest,
} from "@ext/domains/walmart/background/handlers/queue-handlers.ts";

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
    case "WALMART_GET_AUTO_REFRESH_CONFIG":
    case "WALMART_SYNC_AUTO_REFRESH":
    case "WALMART_HARD_RELOAD":
      return handleWalmartAutoRefreshContentMessage(message, sender);
    case "WALMART_QUEUE_PASS":
      return handleWalmartQueuePass(message, sender);
    case "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST":
      return handleWalmartQueueTabConsolidateRequest(message, sender);
    default:
      return { ok: false, error: "Unknown message" };
  }
}
