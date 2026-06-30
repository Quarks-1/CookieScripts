import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import type { WalmartLastExport, WalmartRecordingMetrics } from "@ext/domains/walmart/types/walmart.ts";

const tabSessionMap = new Map<number, string>();
const activeRecordingTabs = new Set<number>();
const exportLocks = new Set<string>();
const flushAcks = new Map<number, Promise<void>>();

let activeRecordingSessionId: string | null = null;

const DEFAULT_METRICS: WalmartRecordingMetrics = {
  sessionId: null,
  eventCount: 0,
  bytes: 0,
  dropDate: null,
  recordingActive: false,
  startedAt: null,
};

export function bindWalmartTab(tabId: number, sessionId: string): void {
  tabSessionMap.set(tabId, sessionId);
  activeRecordingTabs.add(tabId);
}

export function unbindWalmartTab(tabId: number): void {
  tabSessionMap.delete(tabId);
  activeRecordingTabs.delete(tabId);
  flushAcks.delete(tabId);
}

export function getWalmartTabSession(tabId: number): string | undefined {
  return tabSessionMap.get(tabId);
}

export function isWalmartTabRecording(tabId: number): boolean {
  return activeRecordingTabs.has(tabId);
}

export function isAnyWalmartRecording(): boolean {
  return activeRecordingTabs.size > 0;
}

export function getActiveRecordingSessionId(): string | null {
  return activeRecordingSessionId;
}

export async function setActiveRecordingSessionId(sessionId: string | null): Promise<void> {
  activeRecordingSessionId = sessionId;
  if (sessionId === null) {
    await chrome.storage.session.remove(STORAGE_KEYS.walmartActiveSession);
    return;
  }
  await chrome.storage.session.set({ [STORAGE_KEYS.walmartActiveSession]: sessionId });
}

export async function readPersistedActiveRecordingSessionId(): Promise<string | null> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.walmartActiveSession);
  const id = result[STORAGE_KEYS.walmartActiveSession];
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

export async function readMetrics(): Promise<WalmartRecordingMetrics> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.walmartMetrics);
  return (result[STORAGE_KEYS.walmartMetrics] as WalmartRecordingMetrics | undefined) ?? DEFAULT_METRICS;
}

export async function writeMetrics(metrics: WalmartRecordingMetrics): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.walmartMetrics]: metrics });
}

export async function readLastExport(): Promise<WalmartLastExport | null> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.walmartLastExport);
  return (result[STORAGE_KEYS.walmartLastExport] as WalmartLastExport | undefined) ?? null;
}

export async function writeLastExport(exportInfo: WalmartLastExport): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.walmartLastExport]: exportInfo });
}

export async function loadWalmartRecordingState(): Promise<string | null> {
  const persisted = await readPersistedActiveRecordingSessionId();
  activeRecordingSessionId = persisted;
  return persisted;
}

export type WalmartTabAutoRefreshState = {
  enabled: boolean;
  interval_sec: number;
  last_refresh_at?: number;
};

const tabAutoRefreshMap = new Map<number, WalmartTabAutoRefreshState>();

export function getWalmartTabAutoRefresh(tabId: number): WalmartTabAutoRefreshState | undefined {
  return tabAutoRefreshMap.get(tabId);
}

export function hasWalmartTabAutoRefresh(tabId: number): boolean {
  return tabAutoRefreshMap.has(tabId);
}

export function setWalmartTabAutoRefresh(tabId: number, state: WalmartTabAutoRefreshState): void {
  tabAutoRefreshMap.set(tabId, state);
}

export function clearWalmartTabAutoRefresh(tabId: number): void {
  tabAutoRefreshMap.delete(tabId);
}

export function listWalmartTabAutoRefreshTabIds(): number[] {
  return [...tabAutoRefreshMap.keys()];
}

export function clearAllWalmartTabAutoRefresh(): void {
  tabAutoRefreshMap.clear();
}

export function clearWalmartRuntimeState(): void {
  tabAutoRefreshMap.clear();
  tabSessionMap.clear();
  activeRecordingTabs.clear();
  exportLocks.clear();
  flushAcks.clear();
  activeRecordingSessionId = null;
}
