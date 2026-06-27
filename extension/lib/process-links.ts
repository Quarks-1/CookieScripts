import { MAX_URLS_PER_MESSAGE } from "@ext/lib/constants.ts";
import {
  filterUrlsByDomains,
  isHttpOrHttpsUrl,
  normalizeUrlForDedup,
} from "@ext/lib/links.ts";
import type { HistoryItem } from "@ext/types/index.ts";

export interface DecideLinkActionsInput {
  urls: string[];
  allowedDomains: string[];
  recentUrlKeys: Set<string>;
  enabled: boolean;
  channelId: string;
  author?: string;
}

export interface DecideLinkActionsResult {
  toOpen: string[];
  duplicates: string[];
  newDedupKeys: string[];
  historyEntries: HistoryItem[];
}

export function decideLinkActions(input: DecideLinkActionsInput): DecideLinkActionsResult {
  const { urls, allowedDomains, recentUrlKeys, enabled, channelId, author = "unknown" } = input;

  if (!enabled || !allowedDomains.length) {
    return { toOpen: [], duplicates: [], newDedupKeys: [], historyEntries: [] };
  }

  const cappedUrls = urls.slice(0, MAX_URLS_PER_MESSAGE);
  const matched = filterUrlsByDomains(cappedUrls, allowedDomains).filter(isHttpOrHttpsUrl);

  const toOpen: string[] = [];
  const duplicates: string[] = [];
  const newDedupKeys: string[] = [];
  const historyEntries: HistoryItem[] = [];
  const now = new Date().toISOString();

  for (const url of matched) {
    const dedupKey = normalizeUrlForDedup(url);
    if (recentUrlKeys.has(dedupKey) || newDedupKeys.includes(dedupKey)) {
      duplicates.push(url);
      historyEntries.push({
        kind: "duplicate",
        url,
        author,
        channel_id: channelId,
        timestamp: now,
      });
      continue;
    }
    newDedupKeys.push(dedupKey);
    toOpen.push(url);
    historyEntries.push({
      kind: "opened",
      url,
      author,
      channel_id: channelId,
      timestamp: now,
    });
  }

  return { toOpen, duplicates, newDedupKeys, historyEntries };
}
