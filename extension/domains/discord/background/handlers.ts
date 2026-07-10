import { resolveContentChannel } from "@ext/core/lib/channels.ts";
import {
  addChannelDomain,
  getChannelDomains,
  getChannelKeywords,
  getChannelWatchSkus,
} from "@ext/core/lib/channel-targets.ts";
import { shouldOpenByKeywords } from "@ext/core/lib/keywords.ts";
import { normalizeUrlForDedup } from "@ext/core/lib/links.ts";
import { decideLinkActions } from "@ext/core/lib/process-links.ts";
import { addIgnoredDomain } from "@ext/core/lib/ignored-domains.ts";
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

async function handleSkuModeCandidateLinks(
  message: Extract<ContentToBackground, { type: "CANDIDATE_LINKS" }>,
  channelId: string,
  settings: ExtensionSettings,
): Promise<{ opened: string[]; duplicates: string[] }> {
  const configuredSkus = getChannelWatchSkus(settings, channelId, "target");
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

      let result: { opened: string[]; duplicates: string[] } = {
        opened: [],
        duplicates: [],
      };

      await enqueueLinkProcessing(async () => {
        if (getSkuOpenModeEnabled(settings)) {
          result = await handleSkuModeCandidateLinks(message, channelId, settings);
          return;
        }

        const decision = decideLinkActions({
          urls: message.urls,
          allowedDomains,
          recentUrlKeys,
          enabled: settings.enabled,
          channelId,
          author: message.author,
        });

        const { positive, negative } = getChannelKeywords(settings, channelId);
        const keywordAllowed = shouldOpenByKeywords(
          message.message_text ?? "",
          positive,
          negative,
        );

        if (!keywordAllowed && decision.toOpen.length > 0) {
          const now = new Date().toISOString();
          const skippedHistory: HistoryItem[] = decision.toOpen.map((url) => ({
            kind: "keyword_skipped",
            url,
            author: message.author ?? "unknown",
            channel_id: channelId,
            timestamp: now,
          }));
          const duplicateHistory = decision.historyEntries.filter(
            (entry) => entry.kind === "duplicate",
          );
          if (skippedHistory.length > 0 || duplicateHistory.length > 0) {
            await prependHistory([...skippedHistory, ...duplicateHistory]);
          }

          result = {
            opened: [],
            duplicates: decision.duplicates,
          };
          return;
        }

        mergeDedupKeys(decision.newDedupKeys);
        scheduleRecentUrlsPersist();

        const opened: string[] = [];
        const histories: HistoryItem[] = [];

        for (const entry of decision.historyEntries) {
          if (entry.kind === "duplicate") {
            histories.push(entry);
            continue;
          }
          const openResult = await openTargetLinkRepeated(entry.url, channelId, settings, {
            inWindow: getOpenLinksInWindow(settings),
            author: entry.author,
            timestamp: entry.timestamp,
          });
          opened.push(...openResult.opened);
          histories.push(...openResult.histories);
        }

        if (histories.length > 0) {
          await prependHistory(histories);
        }

        result = {
          opened,
          duplicates: decision.duplicates,
        };
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
