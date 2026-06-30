import { isRetailerUrl } from "@ext/lib/retailer/host.ts";
import { isWalmartUrl } from "@ext/lib/walmart/host.ts";
import type { ActiveTabKind } from "@ext/types/index.ts";

export function resolveActiveTabKind(url?: string | null): ActiveTabKind {
  if (!url) {
    return "other";
  }
  if (isWalmartUrl(url)) {
    return "walmart";
  }
  if (isRetailerUrl(url)) {
    return "retailer";
  }
  if (url.startsWith("https://discord.com/channels/")) {
    return "discord_channel";
  }
  return "other";
}
