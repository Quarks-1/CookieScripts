import { normalizeDomain } from "@ext/core/lib/domains.ts";
import { normalizeKeywordList } from "@ext/core/lib/keywords.ts";
import { normalizeTargetSkuList } from "@ext/domains/target/lib/index.ts";
import { normalizeWalmartSkuList } from "@ext/domains/walmart/lib/index.ts";
import { allowlistIncludesRetailerHost } from "@ext/domains/target/lib/host.ts";
import type { ChannelTarget, ExtensionSettings } from "@ext/core/types/index.ts";

export type WatchSkuRetailer = "target" | "walmart";
export type WatchKeywordRetailer = "target" | "walmart";

type KeywordPair = { positive: string[]; negative: string[] };

type LegacyChannelRow = ChannelTarget & {
  watch_keywords?: ExtensionSettings["watch_keywords"];
  watch_skus?: ExtensionSettings["watch_skus"];
  retailer_auto_atc_enabled?: boolean;
  positive_keywords?: string[];
  negative_keywords?: string[];
};

function normalizeKeywordPair(positive: string[], negative: string[]): KeywordPair {
  return {
    positive: normalizeKeywordList(positive),
    negative: normalizeKeywordList(negative),
  };
}

function cleanupKeywordPair(pair: { positive?: string[]; negative?: string[] } | undefined): {
  positive?: string[];
  negative?: string[];
} | undefined {
  if (!pair) {
    return undefined;
  }
  const next: { positive?: string[]; negative?: string[] } = {};
  if (pair.positive?.length) {
    next.positive = pair.positive;
  }
  if (pair.negative?.length) {
    next.negative = pair.negative;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function cleanupGlobalWatchKeywords(
  watchKeywords: ExtensionSettings["watch_keywords"],
): ExtensionSettings["watch_keywords"] | undefined {
  if (!watchKeywords) {
    return undefined;
  }
  const next = { ...watchKeywords };
  const target = cleanupKeywordPair(next.target);
  const walmart = cleanupKeywordPair(next.walmart);
  if (target) {
    next.target = target;
  } else {
    delete next.target;
  }
  if (walmart) {
    next.walmart = walmart;
  } else {
    delete next.walmart;
  }
  return next.target || next.walmart ? next : undefined;
}

function cleanupGlobalWatchSkus(
  watchSkus: ExtensionSettings["watch_skus"],
): ExtensionSettings["watch_skus"] | undefined {
  if (!watchSkus) {
    return undefined;
  }
  const next = { ...watchSkus };
  if (!next.target?.length) {
    delete next.target;
  }
  if (!next.walmart?.length) {
    delete next.walmart;
  }
  return next.target || next.walmart ? next : undefined;
}

function buildGlobalWatchKeywords(patch: {
  target_positive_keywords: string[];
  target_negative_keywords: string[];
  walmart_positive_keywords: string[];
  walmart_negative_keywords: string[];
}): ExtensionSettings["watch_keywords"] | undefined {
  const watchKeywords: NonNullable<ExtensionSettings["watch_keywords"]> = {};

  const target = normalizeKeywordPair(
    patch.target_positive_keywords,
    patch.target_negative_keywords,
  );
  if (target.positive.length || target.negative.length) {
    watchKeywords.target = target;
  }

  const walmart = normalizeKeywordPair(
    patch.walmart_positive_keywords,
    patch.walmart_negative_keywords,
  );
  if (walmart.positive.length || walmart.negative.length) {
    watchKeywords.walmart = walmart;
  }

  return cleanupGlobalWatchKeywords(
    Object.keys(watchKeywords).length > 0 ? watchKeywords : undefined,
  );
}

function buildGlobalWatchSkus(
  existing: ExtensionSettings["watch_skus"] | undefined,
  patch?: { target?: string[]; walmart?: string[] },
): ExtensionSettings["watch_skus"] | undefined {
  const existingSkus = existing ?? {};
  const target =
    patch?.target !== undefined ? normalizeTargetSkuList(patch.target) : existingSkus.target;
  const walmart =
    patch?.walmart !== undefined ? normalizeWalmartSkuList(patch.walmart) : existingSkus.walmart;
  const next: NonNullable<ExtensionSettings["watch_skus"]> = {};
  if (target?.length) {
    next.target = target;
  }
  if (walmart?.length) {
    next.walmart = walmart;
  }
  return cleanupGlobalWatchSkus(Object.keys(next).length > 0 ? next : undefined);
}

function rowHasLegacyWatchFields(row: LegacyChannelRow): boolean {
  return (
    row.watch_keywords !== undefined ||
    row.watch_skus !== undefined ||
    row.retailer_auto_atc_enabled !== undefined ||
    row.positive_keywords !== undefined ||
    row.negative_keywords !== undefined
  );
}

function stripLegacyRowFields(row: LegacyChannelRow): ChannelTarget {
  const {
    watch_keywords: _watchKeywords,
    watch_skus: _watchSkus,
    retailer_auto_atc_enabled: _autoAtc,
    positive_keywords: _positive,
    negative_keywords: _negative,
    ...rest
  } = row;
  return rest;
}

export function getChannelTarget(
  settings: ExtensionSettings,
  channelId: string,
): ChannelTarget | undefined {
  return settings.channel_targets.find((t) => t.channel_id === channelId);
}

export function getChannelDomains(settings: ExtensionSettings, channelId: string): string[] {
  return getChannelTarget(settings, channelId)?.allowed_domains ?? [];
}

export function getGlobalKeywords(
  settings: ExtensionSettings,
  retailer: WatchKeywordRetailer,
): KeywordPair {
  const nested = settings.watch_keywords?.[retailer];
  return {
    positive: nested?.positive ?? [],
    negative: nested?.negative ?? [],
  };
}

export function getGlobalWatchSkus(
  settings: ExtensionSettings,
  retailer: WatchSkuRetailer,
): string[] {
  return settings.watch_skus?.[retailer] ?? [];
}

export function upsertGlobalWatchSettings(
  settings: ExtensionSettings,
  patch: {
    target_positive_keywords: string[];
    target_negative_keywords: string[];
    walmart_positive_keywords: string[];
    walmart_negative_keywords: string[];
    target_skus?: string[];
    walmart_skus?: string[];
  },
): ExtensionSettings {
  const watch_keywords = buildGlobalWatchKeywords(patch);
  const watch_skus = buildGlobalWatchSkus(settings.watch_skus, {
    target: patch.target_skus,
    walmart: patch.walmart_skus,
  });

  const next: ExtensionSettings = { ...settings };
  if (watch_keywords) {
    next.watch_keywords = watch_keywords;
  } else {
    delete next.watch_keywords;
  }
  if (watch_skus) {
    next.watch_skus = watch_skus;
  } else {
    delete next.watch_skus;
  }
  return next;
}

export function stripChannelWatchFields(settings: ExtensionSettings): {
  settings: ExtensionSettings;
  changed: boolean;
} {
  let changed = false;
  const channel_targets = settings.channel_targets.map((row) => {
    if (!rowHasLegacyWatchFields(row as LegacyChannelRow)) {
      return row;
    }
    changed = true;
    return stripLegacyRowFields(row as LegacyChannelRow);
  });

  if (!changed) {
    return { settings, changed: false };
  }
  return { settings: { ...settings, channel_targets }, changed: true };
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
    retailer_refresh_interval_sec: existing?.retailer_refresh_interval_sec,
    ...patch,
  };

  if (!allowlistIncludesRetailerHost(allowedDomains)) {
    delete merged.retailer_refresh_interval_sec;
  }

  if (
    merged.retailer_refresh_interval_sec === undefined ||
    merged.retailer_refresh_interval_sec <= 0
  ) {
    delete merged.retailer_refresh_interval_sec;
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
