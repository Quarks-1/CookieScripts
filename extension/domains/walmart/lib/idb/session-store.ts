import { MAX_RETAINED_SESSIONS } from "@ext/domains/walmart/lib/constants.ts";
import { formatDropDate, formatSessionTime } from "@ext/domains/walmart/lib/endpoint-index.ts";
import {
  idbDelete,
  idbDeleteByIndex,
  idbGet,
  idbGetAll,
  idbPut,
  STORE_ENDPOINTS,
  STORE_EVENTS,
  STORE_PAGES,
  STORE_SESSIONS,
} from "@ext/domains/walmart/lib/idb/schema.ts";
import type { WalmartSessionMeta } from "@ext/domains/walmart/types/walmart.ts";

export async function pruneOldSessions(): Promise<void> {
  const sessions = await idbGetAll<WalmartSessionMeta>(STORE_SESSIONS);
  if (sessions.length < MAX_RETAINED_SESSIONS) {
    return;
  }
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const toRemove = sorted.slice(0, sessions.length - MAX_RETAINED_SESSIONS + 1);
  for (const session of toRemove) {
    await deleteSession(session.sessionId);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await idbDelete(STORE_SESSIONS, sessionId);
  await idbDeleteByIndex(STORE_EVENTS, "sessionId", sessionId);
  await idbDeleteByIndex(STORE_PAGES, "sessionId", sessionId);
  await idbDeleteByIndex(STORE_ENDPOINTS, "sessionId", sessionId);
}

export async function createSession(input: {
  sessionId: string;
  tabId: number;
  tabIds?: number[];
  primaryTabId?: number | null;
  failedAttachTabIds?: number[];
  url: string;
  userAgent: string;
  extensionVersion?: string;
  probeVersion?: string;
}): Promise<WalmartSessionMeta> {
  const started = new Date();
  const meta: WalmartSessionMeta = {
    sessionId: input.sessionId,
    tabId: input.tabId,
    tabIds: input.tabIds ?? [],
    primaryTabId: input.primaryTabId ?? null,
    failedAttachTabIds: input.failedAttachTabIds ?? [],
    startedAt: started.toISOString(),
    dropDate: formatDropDate(started),
    sessionTime: formatSessionTime(started),
    url: input.url,
    userAgent: input.userAgent,
    extensionVersion: input.extensionVersion,
    probeVersion: input.probeVersion,
    truncated: false,
    droppedEvents: 0,
    byteTotal: 0,
  };
  await idbPut(STORE_SESSIONS, meta);
  void pruneOldSessions();
  return meta;
}

export async function getSession(sessionId: string): Promise<WalmartSessionMeta | undefined> {
  return idbGet<WalmartSessionMeta>(STORE_SESSIONS, sessionId);
}

export async function updateSession(meta: WalmartSessionMeta): Promise<void> {
  await idbPut(STORE_SESSIONS, meta);
}

export async function listSessions(): Promise<WalmartSessionMeta[]> {
  return idbGetAll<WalmartSessionMeta>(STORE_SESSIONS);
}

export async function getLastStoppedSessionForTab(tabId: number): Promise<WalmartSessionMeta | undefined> {
  const sessions = await listSessions();
  const stopped = sessions
    .filter((s) => s.tabId === tabId && s.stoppedAt)
    .sort((a, b) => (b.stoppedAt ?? "").localeCompare(a.stoppedAt ?? ""));
  return stopped[0];
}

export async function getLastStoppedSession(): Promise<WalmartSessionMeta | undefined> {
  const sessions = await listSessions();
  const stopped = sessions
    .filter((s) => s.stoppedAt)
    .sort((a, b) => (b.stoppedAt ?? "").localeCompare(a.stoppedAt ?? ""));
  return stopped[0];
}
