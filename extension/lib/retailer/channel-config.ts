import {
  getChannelTarget,
  mergeChannelTarget,
  upsertChannelDomains,
} from "@ext/lib/channel-targets.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";

export function normalizeRetailerRefreshIntervalSec(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.floor(value), 3600);
}

export function getRetailerRefreshIntervalSec(
  settings: ExtensionSettings,
  channelId: string,
): number {
  if (channelId !== "manual") {
    const perChannel = getChannelTarget(settings, channelId)?.retailer_refresh_interval_sec;
    if (perChannel !== undefined) {
      return normalizeRetailerRefreshIntervalSec(perChannel);
    }
  }
  return normalizeRetailerRefreshIntervalSec(settings.retailer_refresh_interval_sec ?? 0);
}

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

export function setRetailerRefreshInterval(
  settings: ExtensionSettings,
  channelId: string,
  intervalSec: number,
): ExtensionSettings {
  const normalized = normalizeRetailerRefreshIntervalSec(intervalSec);

  if (channelId === "manual") {
    const next = { ...settings };
    if (normalized > 0) {
      next.retailer_refresh_interval_sec = normalized;
    } else {
      delete next.retailer_refresh_interval_sec;
    }
    return next;
  }

  const domains = getChannelTarget(settings, channelId)?.allowed_domains ?? [];
  if (!allowlistIncludesRetailerHost(domains)) {
    return settings;
  }

  return mergeChannelTarget(settings, channelId, {
    allowed_domains: domains,
    retailer_refresh_interval_sec: normalized > 0 ? normalized : undefined,
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
