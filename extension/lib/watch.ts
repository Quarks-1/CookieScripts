import type { ExtensionSettings } from "@ext/types/index.ts";

export function resolveWatchConfig(
  settings: ExtensionSettings,
  channelId: string,
): string[] | null {
  if (!settings.enabled) {
    return null;
  }
  const target = settings.channel_targets.find((t) => t.channel_id === channelId);
  if (!target || !target.allowed_domains.length) {
    return null;
  }
  return target.allowed_domains;
}
