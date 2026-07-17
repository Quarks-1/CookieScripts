import { resolveContentChannel } from "@ext/core/lib/channels.ts";
import {
  addChannelDomain,
  getChannelDomains,
  getGlobalKeywords,
  getGlobalWatchSkus,
} from "@ext/core/lib/channel-targets.ts";
import { shouldOpenByKeywords } from "@ext/core/lib/keywords.ts";
import { normalizeUrlForDedup } from "@ext/core/lib/links.ts";
import { decideLinkActions } from "@ext/core/lib/process-links.ts";
import { addIgnoredDomain } from "@ext/core/lib/ignored-domains.ts";
import { partitionUrlsByRetailer, resolveWatchKeywordRetailer } from "@ext/core/lib/retailer-url.ts";
import { decideSkuOpenAction } from "@ext/core/lib/sku-watch/decide.ts";
import { getSettings, prependHistory, saveSettings } from "@ext/core/lib/storage.ts";
import { getOpenLinksInWindow, getSkuOpenModeEnabled, resolveWatchConfig } from "@ext/core/lib/watch.ts";
import { openTargetLinkRepeated } from "@ext/core/background/open-product-link.ts";
import {
  enqueueLinkProcessing,
  mergeDedupKeys,
  recentUrlKeys,
  scheduleRecentUrlsPersist,
  activeChannels,
} from "@ext/core/background/runtime-state.ts";
import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import type {
  BackgroundResponse,
  ContentToBackground,
  ExtensionSettings,
  HistoryItem,
} from "@ext/core/types/index.ts";

function watchConfigResponse(channelId: string, settings: ExtensionSettings) {
  const allowedDomains = settings.enabled ? getChannelDomains(settings, channelId) : [];
  return {
    type: "WATCH_CONFIG" as const,
    channel_id: settings.enabled ? channelId : null,
    allowed_domains: allowedDomains,
  };
}

type LinkOpenResult = { opened: string[]; duplicates: string[] };

function keywordsForUrl(
  settings: ExtensionSettings,
  url: string,
): { positive: string[]; negative: string[] } {
  const retailer = resolveWatchKeywordRetailer(url);
  if (retailer === null) {
    return { positive: [], negative: [] };
  }
  return getGlobalKeywords(settings, retailer);
}

async function handleSkuModeTargetPath(
  message: Extract<ContentToBackground, { type: "CANDIDATE_LINKS" }>,
  channelId: string,
  settings: ExtensionSettings,
): Promise<LinkOpenResult> {
  const configuredSkus = getGlobalWatchSkus(settings, "target");
  const decision = decideSkuOpenAction({
    messageText: message.message_text ?? "",
    urls: message.urls,
    anchors: message.anchors,
    configuredSkus,
  });

  if (decision.action === "none") {
    return { opened: [], duplicates: [] };
  }

  const author = message.author ?? "unknown";
  const now = new Date().toISOString();

  if (decision.action === "skip") {
    if (decision.url) {
      await prependHistory([
        {
          kind: "sku_skipped",
          url: decision.url,
          author,
          channel_id: channelId,
          timestamp: now,
        },
      ]);
    }
    return { opened: [], duplicates: [] };
  }

  const dedupKey = normalizeUrlForDedup(decision.url);
  if (recentUrlKeys.has(dedupKey)) {
    await prependHistory([
      {
        kind: "duplicate",
        url: decision.url,
        author,
        channel_id: channelId,
        timestamp: now,
      },
    ]);
    return { opened: [], duplicates: [decision.url] };
  }

  mergeDedupKeys([dedupKey]);
  scheduleRecentUrlsPersist();

  const openResult = await openTargetLinkRepeated(decision.url, channelId, settings, {
    inWindow: getOpenLinksInWindow(settings),
    author,
    timestamp: now,
  });

  if (openResult.histories.length > 0) {
    await prependHistory(openResult.histories);
  }

  return {
    opened: openResult.opened,
    duplicates: [],
  };
}

async function handleWalmartLinkPath(
  message: Extract<ContentToBackground, { type: "CANDIDATE_LINKS" }>,
  channelId: string,
  settings: ExtensionSettings,
  allowedDomains: string[],
): Promise<LinkOpenResult> {
  const walmartUrls = partitionUrlsByRetailer(message.urls).walmart;
  if (walmartUrls.length === 0) {
    return { opened: [], duplicates: [] };
  }

  const decision = decideLinkActions({
    urls: walmartUrls,
    allowedDomains,
    recentUrlKeys,
    enabled: settings.enabled,
    channelId,
    author: message.author,
  });

  const messageText = message.message_text ?? "";
  const author = message.author ?? "unknown";
  const now = new Date().toISOString();
  const histories: HistoryItem[] = [];
  const opened: string[] = [];
  const duplicates = [...decision.duplicates];
  const newDedupKeys: string[] = [];

  for (const entry of decision.historyEntries) {
    if (entry.kind === "duplicate") {
      histories.push(entry);
      continue;
    }

    const { positive, negative } = keywordsForUrl(settings, entry.url);
    if (!shouldOpenByKeywords(messageText, positive, negative)) {
      histories.push({
        kind: "keyword_skipped",
        url: entry.url,
        author,
        channel_id: channelId,
        timestamp: now,
      });
      continue;
    }

    const dedupKey = normalizeUrlForDedup(entry.url);
    newDedupKeys.push(dedupKey);
    const openResult = await openTargetLinkRepeated(entry.url, channelId, settings, {
      inWindow: getOpenLinksInWindow(settings),
      author: entry.author,
      timestamp: entry.timestamp,
    });
    opened.push(...openResult.opened);
    histories.push(...openResult.histories);
  }

  if (newDedupKeys.length > 0) {
    mergeDedupKeys(newDedupKeys);
    scheduleRecentUrlsPersist();
  }

  if (histories.length > 0) {
    await prependHistory(histories);
  }

  return { opened, duplicates };
}

async function handleNormalModeCandidateLinks(
  message: Extract<ContentToBackground, { type: "CANDIDATE_LINKS" }>,
  channelId: string,
  settings: ExtensionSettings,
  allowedDomains: string[],
): Promise<LinkOpenResult> {
  const decision = decideLinkActions({
    urls: message.urls,
    allowedDomains,
    recentUrlKeys,
    enabled: settings.enabled,
    channelId,
    author: message.author,
  });

  const messageText = message.message_text ?? "";
  const author = message.author ?? "unknown";
  const now = new Date().toISOString();
  const histories: HistoryItem[] = [];
  const opened: string[] = [];
  const newDedupKeys: string[] = [];

  for (const entry of decision.historyEntries) {
    if (entry.kind === "duplicate") {
      histories.push(entry);
      continue;
    }

    const { positive, negative } = keywordsForUrl(settings, entry.url);
    if (!shouldOpenByKeywords(messageText, positive, negative)) {
      histories.push({
        kind: "keyword_skipped",
        url: entry.url,
        author,
        channel_id: channelId,
        timestamp: now,
      });
      continue;
    }

    const dedupKey = normalizeUrlForDedup(entry.url);
    newDedupKeys.push(dedupKey);
    const openResult = await openTargetLinkRepeated(entry.url, channelId, settings, {
      inWindow: getOpenLinksInWindow(settings),
      author: entry.author,
      timestamp: entry.timestamp,
    });
    opened.push(...openResult.opened);
    histories.push(...openResult.histories);
  }

  if (newDedupKeys.length > 0) {
    mergeDedupKeys(newDedupKeys);
    scheduleRecentUrlsPersist();
  }

  if (histories.length > 0) {
    await prependHistory(histories);
  }

  return { opened, duplicates: decision.duplicates };
}

function mergeLinkOpenResults(a: LinkOpenResult, b: LinkOpenResult): LinkOpenResult {
  return {
    opened: [...a.opened, ...b.opened],
    duplicates: [...a.duplicates, ...b.duplicates],
  };
}

export async function handleDiscordMessage(
  message: ContentToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse | undefined> {
  const tabId = sender.tab!.id!;

  switch (message.type) {
    case "CHANNEL_ACTIVE": {
      const channelId = resolveContentChannel(sender, message.channel_id);
      if (!channelId) {
        return undefined;
      }
      activeChannels.set(tabId, channelId);
      await notifyStatusChanged();
      const settings = await getSettings();
      return watchConfigResponse(channelId, settings);
    }
    case "CHANNEL_INACTIVE": {
      activeChannels.delete(tabId);
      await notifyStatusChanged();
      return undefined;
    }
    case "CANDIDATE_LINKS": {
      const channelId = resolveContentChannel(sender, message.channel_id);
      if (!channelId) {
        return { ok: false, error: "Invalid channel" };
      }
      const settings = await getSettings();
      const allowedDomains = resolveWatchConfig(settings, channelId);
      if (!allowedDomains?.length) {
        return { ok: true, opened: [], duplicates: [] };
      }

      let result: LinkOpenResult = { opened: [], duplicates: [] };

      await enqueueLinkProcessing(async () => {
        if (getSkuOpenModeEnabled(settings)) {
          const targetResult = await handleSkuModeTargetPath(message, channelId, settings);
          const walmartResult = await handleWalmartLinkPath(
            message,
            channelId,
            settings,
            allowedDomains,
          );
          result = mergeLinkOpenResults(targetResult, walmartResult);
          return;
        }

        result = await handleNormalModeCandidateLinks(
          message,
          channelId,
          settings,
          allowedDomains,
        );
      });

      return { ok: true, ...result };
    }
    case "ADD_ALLOWED_DOMAIN": {
      const channelId = resolveContentChannel(sender, message.channel_id);
      if (!channelId) {
        return { ok: false, error: "Invalid channel" };
      }
      const settings = await getSettings();
      const next = addChannelDomain(settings, channelId, message.domain);
      await saveSettings(next);
      return { ok: true };
    }
    case "IGNORE_DOMAIN": {
      const channelId = resolveContentChannel(sender, message.channel_id);
      if (!channelId) {
        return { ok: false, error: "Invalid channel" };
      }
      await addIgnoredDomain(channelId, message.domain);
      return { ok: true };
    }
  }
}
