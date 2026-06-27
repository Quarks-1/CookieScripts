import { getChannelDomains } from "@ext/lib/channel-targets.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";

export function resolveWatchConfig(
  settings: ExtensionSettings,
  channelId: string,
): string[] | null {
  if (!settings.enabled) {
    return null;
  }
  return getChannelDomains(settings, channelId);
}
