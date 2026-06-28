import { getChannelDomains } from "@ext/lib/channel-targets.ts";
import {
  getRetailerAutoEnabled,
  getRetailerRefreshIntervalSec,
  setRetailerAutoEnabled,
  setRetailerRefreshInterval,
} from "@ext/lib/retailer/channel-config.ts";
import { resolveActiveTabKind } from "@ext/lib/active-tab.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import { getSettings, saveSettings } from "@ext/lib/storage.ts";
import { activeChannels } from "@ext/background/runtime-state.ts";
import { getRetailerTabUiState } from "@ext/background/retailer-runtime-state.ts";
import { parseChannelId } from "@ext/lib/channels.ts";
import type { ExtensionSettings, ExtensionStatus } from "@ext/types/index.ts";

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

  const activeTabKind = resolveActiveTabKind(activeTab?.url);

  const retailerTabDetected = activeTabKind === "retailer";

  const allowedDomains =
    activeChannelId !== null ? getChannelDomains(settings, activeChannelId) : [];
  const isActive = settings.enabled && activeChannelId !== null;
  const retailerAutoEnabled =
    activeChannelId !== null ? getRetailerAutoEnabled(settings, activeChannelId) : false;
  const retailerRefreshIntervalSec =
    activeChannelId !== null
      ? getRetailerRefreshIntervalSec(settings, activeChannelId)
      : getRetailerRefreshIntervalSec(settings, "manual");

  const tabUi =
    activeTab?.id != null && retailerTabDetected
      ? getRetailerTabUiState(activeTab.id)
      : { status: "", running: false };

  return {
    enabled: settings.enabled,
    active_tab_kind: activeTabKind,
    discord_tab_detected: discordTabDetected,
    retailer_tab_detected: retailerTabDetected,
    active_channel_id: activeChannelId,
    is_active: isActive,
    has_allowed_domains: allowedDomains.length > 0,
    allowed_domains: allowedDomains,
    retailer_auto_enabled: retailerAutoEnabled && allowlistIncludesRetailerHost(allowedDomains),
    retailer_refresh_interval_sec: retailerRefreshIntervalSec,
    retailer_manual_status: tabUi.status,
    retailer_manual_running: tabUi.running,
  };
}

export async function setRetailerAutoEnabledForChannel(
  channelId: string,
  enabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAutoEnabled(settings, channelId, enabled);
  await saveSettings(next);
  return next;
}

export async function setRetailerRefreshIntervalForChannel(
  channelId: string,
  intervalSec: number,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerRefreshInterval(settings, channelId, intervalSec);
  await saveSettings(next);
  return next;
}
