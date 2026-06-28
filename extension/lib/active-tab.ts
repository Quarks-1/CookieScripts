import { isRetailerUrl } from "@ext/lib/retailer/host.ts";
import type { ActiveTabKind } from "@ext/types/index.ts";

export function resolveActiveTabKind(url?: string | null): ActiveTabKind {
  if (!url) {
    return "other";
  }
  if (isRetailerUrl(url)) {
    return "retailer";
  }
  if (url.startsWith("https://discord.com/channels/")) {
    return "discord_channel";
  }
  return "other";
}
