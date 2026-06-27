import { normalizeDomain } from "@ext/lib/domains.ts";
import type { ExtensionSettings } from "@ext/types/index.ts";

export function getChannelDomains(settings: ExtensionSettings, channelId: string): string[] {
  const target = settings.channel_targets.find((t) => t.channel_id === channelId);
  return target?.allowed_domains ?? [];
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

export function upsertChannelDomains(
  settings: ExtensionSettings,
  channelId: string,
  domains: string[],
): ExtensionSettings {
  const allowedDomains = normalizeDomainList(domains);
  const others = settings.channel_targets.filter((t) => t.channel_id !== channelId);

  if (allowedDomains.length === 0) {
    return { ...settings, channel_targets: others };
  }

  return {
    ...settings,
    channel_targets: [...others, { channel_id: channelId, allowed_domains: allowedDomains }],
  };
}
