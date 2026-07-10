import { normalizeDomain } from "@ext/core/lib/domains.ts";
import { normalizeKeywordList } from "@ext/core/lib/keywords.ts";
import { normalizeTargetSkuList } from "@ext/domains/target/lib/index.ts";
import { allowlistIncludesRetailerHost } from "@ext/domains/target/lib/host.ts";
import type { ChannelTarget, ExtensionSettings } from "@ext/core/types/index.ts";

export type WatchSkuRetailer = "target" | "walmart";

export function getChannelTarget(
  settings: ExtensionSettings,
  channelId: string,
): ChannelTarget | undefined {
  return settings.channel_targets.find((t) => t.channel_id === channelId);
}

export function getChannelDomains(settings: ExtensionSettings, channelId: string): string[] {
  return getChannelTarget(settings, channelId)?.allowed_domains ?? [];
}

export function getChannelKeywords(
  settings: ExtensionSettings,
  channelId: string,
): { positive: string[]; negative: string[] } {
  const target = getChannelTarget(settings, channelId);
  return {
    positive: target?.positive_keywords ?? [],
    negative: target?.negative_keywords ?? [],
  };
}

export function getChannelWatchSkus(
  settings: ExtensionSettings,
  channelId: string,
  retailer: WatchSkuRetailer,
): string[] {
  return getChannelTarget(settings, channelId)?.watch_skus?.[retailer] ?? [];
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

function cleanupKeywordFields(row: ChannelTarget): ChannelTarget {
  const next = { ...row };
  if (!next.positive_keywords?.length) {
    delete next.positive_keywords;
  }
  if (!next.negative_keywords?.length) {
    delete next.negative_keywords;
  }
  return next;
}

function cleanupWatchSkuFields(row: ChannelTarget): ChannelTarget {
  const next = cleanupKeywordFields(row);
  if (!next.watch_skus) {
    return next;
  }
  const watchSkus = { ...next.watch_skus };
  if (!watchSkus.target?.length) {
    delete watchSkus.target;
  }
  if (!watchSkus.walmart?.length) {
    delete watchSkus.walmart;
  }
  if (!watchSkus.target && !watchSkus.walmart) {
    delete next.watch_skus;
  } else {
    next.watch_skus = watchSkus;
  }
  return next;
}

function normalizeWatchSkus(
  watchSkus: ChannelTarget["watch_skus"] | undefined,
  patch?: { target?: string[] },
): ChannelTarget["watch_skus"] | undefined {
  const existing = watchSkus ?? {};
  const target =
    patch?.target !== undefined ? normalizeTargetSkuList(patch.target) : existing.target;
  const next: NonNullable<ChannelTarget["watch_skus"]> = {};
  if (target?.length) {
    next.target = target;
  }
  if (existing.walmart?.length) {
    next.walmart = existing.walmart;
  }
  return Object.keys(next).length > 0 ? next : undefined;
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
    retailer_auto_atc_enabled: existing?.retailer_auto_atc_enabled,
    retailer_refresh_interval_sec: existing?.retailer_refresh_interval_sec,
    positive_keywords: existing?.positive_keywords,
    negative_keywords: existing?.negative_keywords,
    watch_skus: existing?.watch_skus,
    ...patch,
  };

  if (!allowlistIncludesRetailerHost(allowedDomains)) {
    delete merged.retailer_refresh_interval_sec;
  }

  if (merged.retailer_auto_atc_enabled !== true) {
    delete merged.retailer_auto_atc_enabled;
  }

  if (
    merged.retailer_refresh_interval_sec === undefined ||
    merged.retailer_refresh_interval_sec <= 0
  ) {
    delete merged.retailer_refresh_interval_sec;
  }

  return cleanupWatchSkuFields(merged);
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

export function upsertChannelDiscordTarget(
  settings: ExtensionSettings,
  channelId: string,
  patch: {
    allowed_domains: string[];
    positive_keywords: string[];
    negative_keywords: string[];
    target_skus?: string[];
  },
): ExtensionSettings {
  const allowedDomains = normalizeDomainList(patch.allowed_domains);
  if (allowedDomains.length === 0) {
    throw new Error("Add at least one allowed domain first");
  }

  const existing = getChannelTarget(settings, channelId);
  const watch_skus = normalizeWatchSkus(existing?.watch_skus, {
    target: patch.target_skus,
  });

  return mergeChannelTarget(settings, channelId, {
    allowed_domains: allowedDomains,
    positive_keywords: normalizeKeywordList(patch.positive_keywords),
    negative_keywords: normalizeKeywordList(patch.negative_keywords),
    watch_skus,
  });
}

export function upsertChannelKeywords(
  settings: ExtensionSettings,
  channelId: string,
  positive: string[],
  negative: string[],
): ExtensionSettings {
  const domains = getChannelDomains(settings, channelId);
  if (domains.length === 0) {
    throw new Error("Add at least one allowed domain first");
  }
  const existing = getChannelTarget(settings, channelId);
  return upsertChannelDiscordTarget(settings, channelId, {
    allowed_domains: domains,
    positive_keywords: positive,
    negative_keywords: negative,
    target_skus: existing?.watch_skus?.target,
  });
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
