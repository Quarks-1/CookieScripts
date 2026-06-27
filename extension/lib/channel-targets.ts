import { normalizeDomain } from "@ext/lib/domains.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import type { ChannelTarget, ExtensionSettings } from "@ext/types/index.ts";

export function getChannelTarget(
  settings: ExtensionSettings,
  channelId: string,
): ChannelTarget | undefined {
  return settings.channel_targets.find((t) => t.channel_id === channelId);
}

export function getChannelDomains(settings: ExtensionSettings, channelId: string): string[] {
  return getChannelTarget(settings, channelId)?.allowed_domains ?? [];
}

function normalizeDomainList(domains: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of domains) {
    const domain = normalizeDomain(raw);
    if (!domain || seen.has(domain)) {
      continue;
    }
    seen.add(domain);
    result.push(domain);
  }
  return result;
}

function buildChannelTargetRow(
  channelId: string,
  allowedDomains: string[],
  existing?: ChannelTarget,
  patch?: Partial<ChannelTarget>,
): ChannelTarget {
  const merged: ChannelTarget = {
    channel_id: channelId,
    allowed_domains: allowedDomains,
    retailer_auto_enabled: existing?.retailer_auto_enabled,
    ...patch,
  };

  if (!allowlistIncludesRetailerHost(allowedDomains)) {
    merged.retailer_auto_enabled = false;
  }

  if (merged.retailer_auto_enabled !== true) {
    delete merged.retailer_auto_enabled;
  }

  return merged;
}

export function mergeChannelTarget(
  settings: ExtensionSettings,
  channelId: string,
  patch: Partial<ChannelTarget> & { allowed_domains: string[] },
): ExtensionSettings {
  const allowedDomains = normalizeDomainList(patch.allowed_domains);
  const others = settings.channel_targets.filter((t) => t.channel_id !== channelId);
  const existing = getChannelTarget(settings, channelId);

  if (allowedDomains.length === 0) {
    return { ...settings, channel_targets: others };
  }

  const { allowed_domains: _domains, ...rest } = patch;
  const row = buildChannelTargetRow(channelId, allowedDomains, existing, rest);
  return { ...settings, channel_targets: [...others, row] };
}

export function upsertChannelDomains(
  settings: ExtensionSettings,
  channelId: string,
  domains: string[],
): ExtensionSettings {
  return mergeChannelTarget(settings, channelId, { allowed_domains: domains });
}

export function addChannelDomain(
  settings: ExtensionSettings,
  channelId: string,
  domain: string,
): ExtensionSettings {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return settings;
  }
  const current = getChannelDomains(settings, channelId);
  if (current.includes(normalized)) {
    return settings;
  }
  return upsertChannelDomains(settings, channelId, [...current, normalized]);
}
