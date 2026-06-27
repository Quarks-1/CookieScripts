import { parseChannelId, resolveContentChannel } from "@ext/lib/channels.ts";
import { addChannelDomain, getChannelDomains } from "@ext/lib/channel-targets.ts";
import { decideLinkActions } from "@ext/lib/process-links.ts";
import { addIgnoredDomain } from "@ext/lib/ignored-domains.ts";
import {
  clearHistory,
  getHistory,
  getSettings,
  prependHistory,
  saveSettings,
} from "@ext/lib/storage.ts";
import { resolveWatchConfig } from "@ext/lib/watch.ts";
import {
  activeChannels,
  clearRecentUrlKeys,
  enqueueLinkProcessing,
  mergeDedupKeys,
  recentUrlKeys,
  scheduleRecentUrlsPersist,
} from "@ext/background/runtime-state.ts";
import type {
  BackgroundResponse,
  ContentToBackground,
  ExtensionSettings,
  ExtensionStatus,
  RuntimeMessage,
  UiToBackground,
} from "@ext/types/index.ts";

function isContentSender(sender: chrome.runtime.MessageSender): boolean {
  return (
    sender.id === chrome.runtime.id &&
    sender.tab?.id != null &&
    sender.tab.url?.startsWith("https://discord.com/") === true
  );
}

function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  return (
    sender.id === chrome.runtime.id &&
    sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) === true
  );
}

function watchConfigResponse(channelId: string, settings: ExtensionSettings) {
  const allowedDomains = settings.enabled ? getChannelDomains(settings, channelId) : [];
  return {
    type: "WATCH_CONFIG" as const,
    channel_id: settings.enabled ? channelId : null,
    allowed_domains: allowedDomains,
  };
}

export async function buildStatus(activeTab?: chrome.tabs.Tab): Promise<ExtensionStatus> {
  const settings = await getSettings();

  let activeChannelId: string | null = null;
  let discordTabDetected = false;

  if (activeTab?.id != null) {
    if (activeTab.url?.startsWith("https://discord.com/channels/")) {
      discordTabDetected = true;
      const fromMap = activeChannels.get(activeTab.id);
      if (fromMap) {
        activeChannelId = fromMap;
      } else if (activeTab.url) {
        try {
          activeChannelId = parseChannelId(new URL(activeTab.url).pathname);
        } catch {
          activeChannelId = null;
        }
      }
    }
  }

  if (!discordTabDetected && activeChannels.size > 0) {
    discordTabDetected = true;
  }

  const allowedDomains =
    activeChannelId !== null ? getChannelDomains(settings, activeChannelId) : [];
  const isActive = settings.enabled && activeChannelId !== null;

  return {
    enabled: settings.enabled,
    discord_tab_detected: discordTabDetected,
    active_channel_id: activeChannelId,
    is_active: isActive,
    has_allowed_domains: allowedDomains.length > 0,
    allowed_domains: allowedDomains,
  };
}

async function handleContentMessage(
  message: ContentToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse | undefined> {
  if (!isContentSender(sender)) {
    return { ok: false, error: "Unauthorized sender" };
  }

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

        for (const url of decision.toOpen) {
          await chrome.tabs.create({ url, active: false });
        }

        if (decision.historyEntries.length > 0) {
          await prependHistory(decision.historyEntries);
        }

        result = {
          opened: decision.toOpen,
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

async function handleUiMessage(
  message: UiToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  if (!isExtensionPageSender(sender)) {
    return { ok: false, error: "Unauthorized sender" };
  }

  switch (message.type) {
    case "GET_STATUS": {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const status = await buildStatus(activeTab);
      return { ok: true, status };
    }
    case "GET_SETTINGS": {
      const settings = await getSettings();
      return { ok: true, settings };
    }
    case "SAVE_SETTINGS": {
      try {
        await saveSettings(message.settings);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "GET_HISTORY": {
      const history = await getHistory();
      return { ok: true, history };
    }
    case "CLEAR_HISTORY": {
      await clearHistory();
      clearRecentUrlKeys();
      return { ok: true };
    }
    case "GET_DETECTED_DOMAINS": {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (
        activeTab?.id == null ||
        !activeTab.url?.startsWith("https://discord.com/channels/")
      ) {
        return { ok: true, domains: [] };
      }
      try {
        const response = (await chrome.tabs.sendMessage(activeTab.id, {
          type: "SCAN_DETECTED_DOMAINS",
        })) as { ok?: boolean; domains?: string[] } | undefined;
        if (response?.ok === true && Array.isArray(response.domains)) {
          return { ok: true, domains: response.domains };
        }
      } catch {
        // Content script may not be injected yet.
      }
      return { ok: true, domains: [] };
    }
  }
}

export async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse | undefined> {
  try {
    switch (message.type) {
      case "CHANNEL_ACTIVE":
      case "CHANNEL_INACTIVE":
      case "CANDIDATE_LINKS":
      case "ADD_ALLOWED_DOMAIN":
      case "IGNORE_DOMAIN":
        return await handleContentMessage(message, sender);
      case "GET_STATUS":
      case "GET_SETTINGS":
      case "SAVE_SETTINGS":
      case "GET_HISTORY":
      case "CLEAR_HISTORY":
      case "GET_DETECTED_DOMAINS":
        return await handleUiMessage(message, sender);
      case "WATCH_CONFIG":
      case "PING":
        return undefined;
      default:
        return undefined;
    }
  } catch (error) {
    console.error("Handler error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Handler failed" };
  }
}
