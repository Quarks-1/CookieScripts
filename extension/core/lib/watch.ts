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
