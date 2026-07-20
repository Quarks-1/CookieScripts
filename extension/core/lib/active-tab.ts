import { isSamsclubUrl } from "@ext/domains/samsclub/lib/index.ts";
import { isRetailerUrl } from "@ext/domains/target/lib/index.ts";
import { isWalmartUrl } from "@ext/domains/walmart/lib/index.ts";
import type { ActiveTabKind } from "@ext/core/types/index.ts";

export function resolveActiveTabKind(url?: string | null): ActiveTabKind {
  if (!url) {
    return "other";
  }
  if (isSamsclubUrl(url)) {
    return "samsclub";
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
