import { attachTabToRecording } from "@ext/domains/walmart/background/tabs.ts";
import {
  getActiveRecordingSessionId,
  getWalmartTabSession,
  isWalmartTabRecording,
  listRecordingTabIds,
  setActiveRecordingSessionId,
  unbindWalmartTab,
  waitForFlushAck,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { getSession, updateSession } from "@ext/domains/walmart/lib/idb/session-store.ts";
import { isWalmartUrl } from "@ext/domains/walmart/lib/host.ts";
import {
  appendTabLeave,
  recordAttachFailure,
  recordAttachSuccess,
  removeTabFromSessionMeta,
  tabUrlById,
  unregisterTabUpdateListener,
} from "@ext/domains/walmart/background/handlers/shared.ts";
import { finalizeAndExport } from "@ext/domains/walmart/background/handlers/recording-lifecycle.ts";

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
