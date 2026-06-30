/**
 * Dedup invariants:
 * 1. recentUrlKeys is authoritative during SW lifetime — merge before tabs.create
 * 2. linkProcessingQueue chains handlers; .catch logs and continues (never strand)
 * 3. FIFO cap RECENT_URL_LIMIT when merging keys
 * 4. Debounced persist calls storage.saveRecentUrls from here, not lib/storage
 * 5. flushRecentUrls on suspend clears pending debounce timer
 */

import { RECENT_URL_LIMIT, RECENT_URLS_DEBOUNCE_MS } from "@ext/core/lib/constants.ts";
import { loadRecentUrls, saveRecentUrls } from "@ext/core/lib/storage.ts";

export const recentUrlKeys = new Set<string>();
export const activeChannels = new Map<number, string>();

let linkProcessingQueue: Promise<void> = Promise.resolve();
let recentUrlsFlushTimer: ReturnType<typeof setTimeout> | null = null;

export async function initRuntimeState(): Promise<void> {
  const stored = await loadRecentUrls();
  recentUrlKeys.clear();
  for (const key of stored.slice(-RECENT_URL_LIMIT)) {
    recentUrlKeys.add(key);
  }
  activeChannels.clear();
}

export function clearRecentUrlKeys(): void {
  recentUrlKeys.clear();
  if (recentUrlsFlushTimer !== null) {
    clearTimeout(recentUrlsFlushTimer);
    recentUrlsFlushTimer = null;
  }
}

export function mergeDedupKeys(newKeys: string[]): void {
  for (const key of newKeys) {
    if (recentUrlKeys.has(key)) {
      continue;
    }
    recentUrlKeys.add(key);
    while (recentUrlKeys.size > RECENT_URL_LIMIT) {
      const oldest = recentUrlKeys.values().next().value;
      if (oldest === undefined) {
        break;
      }
      recentUrlKeys.delete(oldest);
    }
  }
}

export function scheduleRecentUrlsPersist(): void {
  if (recentUrlsFlushTimer !== null) {
    clearTimeout(recentUrlsFlushTimer);
  }
  recentUrlsFlushTimer = setTimeout(() => {
    recentUrlsFlushTimer = null;
    void flushRecentUrls();
  }, RECENT_URLS_DEBOUNCE_MS);
}

export async function flushRecentUrls(): Promise<void> {
  if (recentUrlsFlushTimer !== null) {
    clearTimeout(recentUrlsFlushTimer);
    recentUrlsFlushTimer = null;
  }
  await saveRecentUrls([...recentUrlKeys]);
}

export function enqueueLinkProcessing(task: () => Promise<void>): Promise<void> {
  linkProcessingQueue = linkProcessingQueue
    .then(task)
    .catch((error) => {
      console.error("Link processing failed:", error);
    });
  return linkProcessingQueue;
}

export function onTabRemoved(tabId: number): void {
  activeChannels.delete(tabId);
}
