import { getChannelDomains } from "@ext/core/lib/channel-targets.ts";
import type { ExtensionSettings } from "@ext/core/types/index.ts";

export function resolveWatchConfig(
  settings: ExtensionSettings,
  channelId: string,
): string[] | null {
  if (!settings.enabled) {
    return null;
  }
  return getChannelDomains(settings, channelId);
}

export function getOpenLinksInWindow(settings: ExtensionSettings): boolean {
  return settings.open_links_in_window !== false;
}

export function getSkuOpenModeEnabled(settings: ExtensionSettings): boolean {
  return settings.sku_open_mode_enabled === true;
}
