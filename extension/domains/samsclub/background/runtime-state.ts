import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import type { SamsclubLastExport, SamsclubRecordingMetrics } from "@ext/domains/samsclub/types/samsclub.ts";

const tabSessionMap = new Map<number, string>();
const activeRecordingTabs = new Set<number>();
const exportLocks = new Set<string>();
const flushAcks = new Map<number, Promise<void>>();

let activeRecordingSessionId: string | null = null;

const DEFAULT_METRICS: SamsclubRecordingMetrics = {
  sessionId: null,
  eventCount: 0,
  bytes: 0,
  dropDate: null,
  recordingActive: false,
  startedAt: null,
};

export function bindSamsclubTab(tabId: number, sessionId: string): void {
  tabSessionMap.set(tabId, sessionId);
  activeRecordingTabs.add(tabId);
}

export function unbindSamsclubTab(tabId: number): void {
  tabSessionMap.delete(tabId);
  activeRecordingTabs.delete(tabId);
  flushAcks.delete(tabId);
}

export function getSamsclubTabSession(tabId: number): string | undefined {
  return tabSessionMap.get(tabId);
}

export function isSamsclubTabRecording(tabId: number): boolean {
  return activeRecordingTabs.has(tabId);
}

export function isAnySamsclubRecording(): boolean {
  return activeRecordingTabs.size > 0;
}

export function getActiveRecordingSessionId(): string | null {
  return activeRecordingSessionId;
}

export async function setActiveRecordingSessionId(sessionId: string | null): Promise<void> {
  activeRecordingSessionId = sessionId;
  if (sessionId === null) {
    await chrome.storage.session.remove(STORAGE_KEYS.samsclubActiveSession);
    return;
  }
  await chrome.storage.session.set({ [STORAGE_KEYS.samsclubActiveSession]: sessionId });
}

export async function readPersistedActiveRecordingSessionId(): Promise<string | null> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.samsclubActiveSession);
  const id = result[STORAGE_KEYS.samsclubActiveSession];
  return typeof id === "string" ? id : null;
}

export function listRecordingTabIds(sessionId?: string): number[] {
  const target = sessionId ?? activeRecordingSessionId;
  if (!target) {
    return [];
  }
  const tabIds: number[] = [];
  for (const [tabId, boundSessionId] of tabSessionMap) {
    if (boundSessionId === target) {
      tabIds.push(tabId);
    }
  }
  return tabIds;
}

export function isLastRecordingTab(tabId: number): boolean {
  return activeRecordingTabs.size === 1 && activeRecordingTabs.has(tabId);
}

export function recordingTabCount(): number {
  return activeRecordingTabs.size;
}

export function tryAcquireExport(sessionId: string): boolean {
  if (exportLocks.has(sessionId)) {
    return false;
  }
  exportLocks.add(sessionId);
  return true;
}

export function releaseExport(sessionId: string): void {
  exportLocks.delete(sessionId);
}

export function setFlushAck(tabId: number, promise: Promise<void>): void {
  flushAcks.set(tabId, promise);
}

export async function waitForFlushAck(tabId: number, timeoutMs: number): Promise<void> {
  const pending = flushAcks.get(tabId);
  if (!pending) {
    return;
  }
  await Promise.race([
    pending.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function readMetrics(): Promise<SamsclubRecordingMetrics> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.samsclubMetrics);
  return (result[STORAGE_KEYS.samsclubMetrics] as SamsclubRecordingMetrics | undefined) ?? DEFAULT_METRICS;
}

export async function writeMetrics(metrics: SamsclubRecordingMetrics): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.samsclubMetrics]: metrics });
}

export async function readLastExport(): Promise<SamsclubLastExport | null> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.samsclubLastExport);
  return (result[STORAGE_KEYS.samsclubLastExport] as SamsclubLastExport | undefined) ?? null;
}

export async function writeLastExport(exportInfo: SamsclubLastExport): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.samsclubLastExport]: exportInfo });
}

export async function loadSamsclubRecordingState(): Promise<string | null> {
  const persisted = await readPersistedActiveRecordingSessionId();
  activeRecordingSessionId = persisted;
  return persisted;
}

export type SamsclubTabAutoRefreshState = {
  enabled: boolean;
  interval_sec: number;
  last_refresh_at?: number;
};

const tabAutoRefreshMap = new Map<number, SamsclubTabAutoRefreshState>();

export function getSamsclubTabAutoRefresh(tabId: number): SamsclubTabAutoRefreshState | undefined {
  return tabAutoRefreshMap.get(tabId);
}

export function hasSamsclubTabAutoRefresh(tabId: number): boolean {
  return tabAutoRefreshMap.has(tabId);
}

export function setSamsclubTabAutoRefresh(tabId: number, state: SamsclubTabAutoRefreshState): void {
  tabAutoRefreshMap.set(tabId, state);
}

export function clearSamsclubTabAutoRefresh(tabId: number): void {
  tabAutoRefreshMap.delete(tabId);
}

export function listSamsclubTabAutoRefreshTabIds(): number[] {
  return [...tabAutoRefreshMap.keys()];
}

export function clearAllSamsclubTabAutoRefresh(): void {
  tabAutoRefreshMap.clear();
}

export function clearSamsclubRuntimeState(): void {
  tabAutoRefreshMap.clear();
  tabSessionMap.clear();
  activeRecordingTabs.clear();
  exportLocks.clear();
  flushAcks.clear();
  activeRecordingSessionId = null;
}
