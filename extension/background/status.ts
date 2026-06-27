import { getChannelDomains, getChannelTarget } from "@ext/lib/channel-targets.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import { setRetailerAutoEnabled } from "@ext/lib/retailer/channel-config.ts";
import { getRetailerProfiles, getSettings, saveSettings } from "@ext/lib/storage.ts";
import { activeChannels } from "@ext/background/runtime-state.ts";
import { parseChannelId } from "@ext/lib/channels.ts";
import type { ExtensionSettings, ExtensionStatus } from "@ext/types/index.ts";

export async function buildStatus(activeTab?: chrome.tabs.Tab): Promise<ExtensionStatus> {
  const settings = await getSettings();
  const profiles = await getRetailerProfiles();

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
  const retailerAutoEnabled =
    activeChannelId !== null
      ? getChannelTarget(settings, activeChannelId)?.retailer_auto_enabled === true
      : false;

  return {
    enabled: settings.enabled,
    discord_tab_detected: discordTabDetected,
    active_channel_id: activeChannelId,
    is_active: isActive,
    has_allowed_domains: allowedDomains.length > 0,
    allowed_domains: allowedDomains,
    retailer_auto_enabled: retailerAutoEnabled && allowlistIncludesRetailerHost(allowedDomains),
    retailer_steps_recorded: profiles.target?.steps.length ?? 0,
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
