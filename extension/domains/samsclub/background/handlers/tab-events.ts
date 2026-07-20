import { attachTabToRecording } from "@ext/domains/samsclub/background/tabs.ts";
import {
  getActiveRecordingSessionId,
  getSamsclubTabSession,
  isSamsclubTabRecording,
  listRecordingTabIds,
  setActiveRecordingSessionId,
  unbindSamsclubTab,
  waitForFlushAck,
} from "@ext/domains/samsclub/background/runtime-state.ts";
import { getSession, updateSession } from "@ext/domains/samsclub/lib/idb/session-store.ts";
import { isSamsclubUrl } from "@ext/domains/samsclub/lib/host.ts";
import {
  appendTabLeave,
  recordAttachFailure,
  recordAttachSuccess,
  removeTabFromSessionMeta,
  tabUrlById,
  unregisterTabUpdateListener,
} from "@ext/domains/samsclub/background/handlers/shared.ts";
import { finalizeAndExport } from "@ext/domains/samsclub/background/handlers/recording-lifecycle.ts";
export async function onSamsclubTabUpdated(
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

  if (isSamsclubTabRecording(tabId) && urlChanged && tabUrl && !isSamsclubUrl(tabUrl)) {
    const lastUrl = tabUrlById.get(tabId) ?? tabUrl;
    await waitForFlushAck(tabId, 500);
    await appendTabLeave(sessionId, tabId, lastUrl);
    unbindSamsclubTab(tabId);
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
  if (!tabUrl || !isSamsclubUrl(tabUrl)) {
    return;
  }
  if (isSamsclubTabRecording(tabId)) {
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

export async function onSamsclubTabRemoved(tabId: number): Promise<void> {
  const sessionId = getSamsclubTabSession(tabId);
  if (!sessionId) {
    return;
  }

  await waitForFlushAck(tabId, 500);
  const lastUrl = tabUrlById.get(tabId) ?? "";
  await appendTabLeave(sessionId, tabId, lastUrl);
  unbindSamsclubTab(tabId);
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
