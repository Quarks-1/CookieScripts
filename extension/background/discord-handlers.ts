import { parseChannelId, resolveContentChannel } from "@ext/lib/channels.ts";
import { addChannelDomain, getChannelDomains } from "@ext/lib/channel-targets.ts";
import { decideLinkActions } from "@ext/lib/process-links.ts";
import { addIgnoredDomain } from "@ext/lib/ignored-domains.ts";
import { getSettings, prependHistory, saveSettings } from "@ext/lib/storage.ts";
import { resolveWatchConfig } from "@ext/lib/watch.ts";
import {
  openPassiveProductTab,
  openRetailerProductWindow,
  shouldOpenRetailerWindow,
} from "@ext/background/open-product-link.ts";
import {
  enqueueLinkProcessing,
  mergeDedupKeys,
  recentUrlKeys,
  scheduleRecentUrlsPersist,
  activeChannels,
} from "@ext/background/runtime-state.ts";
import type {
  BackgroundResponse,
  ContentToBackground,
  ExtensionSettings,
  HistoryItem,
} from "@ext/types/index.ts";

function watchConfigResponse(channelId: string, settings: ExtensionSettings) {
  const allowedDomains = settings.enabled ? getChannelDomains(settings, channelId) : [];
  return {
    type: "WATCH_CONFIG" as const,
    channel_id: settings.enabled ? channelId : null,
    allowed_domains: allowedDomains,
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
      const settings = await getSettings();
      return watchConfigResponse(channelId, settings);
    }
    case "CHANNEL_INACTIVE": {
      activeChannels.delete(tabId);
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
        const decision = decideLinkActions({
          urls: message.urls,
          allowedDomains,
          recentUrlKeys,
          enabled: settings.enabled,
          channelId,
          author: message.author,
        });

        mergeDedupKeys(decision.newDedupKeys);
        scheduleRecentUrlsPersist();

        const retailerHistory: HistoryItem[] = [];
        const passiveHistory: HistoryItem[] = [];
        const opened: string[] = [];
        const seenRetailerUrls = new Set<string>();

        for (const entry of decision.historyEntries) {
          if (entry.kind === "duplicate") {
            passiveHistory.push(entry);
            continue;
          }

          const url = entry.url;
          if (shouldOpenRetailerWindow(url, channelId, settings)) {
            if (seenRetailerUrls.has(url)) {
              passiveHistory.push({
                ...entry,
                kind: "duplicate",
              });
              continue;
            }
            seenRetailerUrls.add(url);

            const windowResult = await openRetailerProductWindow(url, channelId, settings, {
              startAuto: true,
            });

            if (windowResult.opened) {
              opened.push(url);
              retailerHistory.push({
                kind: "retailer_window_opened",
                url,
                author: entry.author,
                channel_id: channelId,
                timestamp: entry.timestamp,
              });
            } else if (windowResult.queued) {
              await openPassiveProductTab(url);
              opened.push(url);
              retailerHistory.push({
                kind: "retailer_auto_queued",
                url,
                author: entry.author,
                channel_id: channelId,
                timestamp: entry.timestamp,
                error: "Auto mode skipped — job in progress",
              });
            }
          } else {
            await openPassiveProductTab(url);
            opened.push(url);
            passiveHistory.push(entry);
          }
        }

        const allHistory = [...retailerHistory, ...passiveHistory];
        if (allHistory.length > 0) {
          await prependHistory(allHistory);
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

export { parseChannelId };
