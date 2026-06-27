import {
  getChannelTarget,
  mergeChannelTarget,
  upsertChannelDomains,
} from "@ext/lib/channel-targets.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";

export function getRetailerAutoEnabled(settings: ExtensionSettings, channelId: string): boolean {
  const target = getChannelTarget(settings, channelId);
  return target?.retailer_auto_enabled === true;
}

export function setRetailerAutoEnabled(
  settings: ExtensionSettings,
  channelId: string,
  enabled: boolean,
): ExtensionSettings {
  const domains = getChannelTarget(settings, channelId)?.allowed_domains ?? [];
  if (!allowlistIncludesRetailerHost(domains)) {
    return settings;
  }
  return mergeChannelTarget(settings, channelId, {
    allowed_domains: domains,
    retailer_auto_enabled: enabled,
  });
}

export function saveChannelDomainsWithRetailerInvariant(
  settings: ExtensionSettings,
  channelId: string,
  domains: string[],
): ExtensionSettings {
  const existing = getChannelTarget(settings, channelId);
  const retailerAutoEnabled =
    allowlistIncludesRetailerHost(domains) && existing?.retailer_auto_enabled === true
      ? true
      : allowlistIncludesRetailerHost(domains)
        ? (existing?.retailer_auto_enabled ?? false)
        : false;

  return mergeChannelTarget(settings, channelId, {
    allowed_domains: domains,
    retailer_auto_enabled: retailerAutoEnabled,
  });
}

export function upsertChannelDomainsPreservingRetailer(
  settings: ExtensionSettings,
  channelId: string,
  domains: string[],
): ExtensionSettings {
  return saveChannelDomainsWithRetailerInvariant(settings, channelId, domains);
}

export { upsertChannelDomains };
