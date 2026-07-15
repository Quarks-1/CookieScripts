import { normalizeDomain } from "@ext/core/lib/domains.ts";
import { normalizeKeywordList } from "@ext/core/lib/keywords.ts";
import { normalizeTargetSkuList } from "@ext/domains/target/lib/index.ts";
import { allowlistIncludesRetailerHost } from "@ext/domains/target/lib/host.ts";
import type { ChannelTarget, ExtensionSettings } from "@ext/core/types/index.ts";

export type WatchSkuRetailer = "target" | "walmart";
export type WatchKeywordRetailer = "target" | "walmart";

type KeywordPair = { positive: string[]; negative: string[] };

function normalizeKeywordPair(positive: string[], negative: string[]): KeywordPair {
  return {
    positive: normalizeKeywordList(positive),
    negative: normalizeKeywordList(negative),
  };
}

function legacyKeywordPair(row: ChannelTarget): KeywordPair | null {
  const positive = row.positive_keywords;
  const negative = row.negative_keywords;
  if (!positive?.length && !negative?.length) {
    return null;
  }
  return {
    positive: positive ?? [],
    negative: negative ?? [],
  };
}

function readRetailerKeywords(row: ChannelTarget | undefined, retailer: WatchKeywordRetailer): KeywordPair {
  if (!row) {
    return { positive: [], negative: [] };
  }

  const nested = row.watch_keywords?.[retailer];
  if (nested) {
    return {
      positive: nested.positive ?? [],
      negative: nested.negative ?? [],
    };
  }

  const legacy = legacyKeywordPair(row);
  if (legacy && row.watch_keywords === undefined) {
    return legacy;
  }

  return { positive: [], negative: [] };
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

function cleanupWatchKeywordFields(row: ChannelTarget): ChannelTarget {
  const next = { ...row };
  if (next.watch_keywords) {
    delete next.positive_keywords;
    delete next.negative_keywords;
  }

  if (!next.watch_keywords) {
    return next;
  }

  const watchKeywords = { ...next.watch_keywords };
  const target = cleanupKeywordPair(watchKeywords.target);
  const walmart = cleanupKeywordPair(watchKeywords.walmart);

  if (target) {
    watchKeywords.target = target;
  } else {
    delete watchKeywords.target;
  }
  if (walmart) {
    watchKeywords.walmart = walmart;
  } else {
    delete watchKeywords.walmart;
  }

  if (!watchKeywords.target && !watchKeywords.walmart) {
    delete next.watch_keywords;
  } else {
    next.watch_keywords = watchKeywords;
  }

  return next;
}

function cleanupWatchSkuFields(row: ChannelTarget): ChannelTarget {
  const next = cleanupWatchKeywordFields(row);
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

function buildWatchKeywords(
  existing: ChannelTarget | undefined,
  patch: {
    target_positive_keywords: string[];
    target_negative_keywords: string[];
    walmart_positive_keywords: string[];
    walmart_negative_keywords: string[];
  },
): ChannelTarget["watch_keywords"] | undefined {
  const watchKeywords: NonNullable<ChannelTarget["watch_keywords"]> = {};

  const target = normalizeKeywordPair(
    patch.target_positive_keywords,
    patch.target_negative_keywords,
  );
  if (target.positive.length || target.negative.length) {
    watchKeywords.target = target;
  } else if (existing?.watch_keywords?.target) {
    // Explicit clear — omit target bucket.
  }

  const walmart = normalizeKeywordPair(
    patch.walmart_positive_keywords,
    patch.walmart_negative_keywords,
  );
  if (walmart.positive.length || walmart.negative.length) {
    watchKeywords.walmart = walmart;
  }

  return Object.keys(watchKeywords).length > 0 ? watchKeywords : undefined;
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

export function getChannelKeywords(
  settings: ExtensionSettings,
  channelId: string,
  retailer: WatchKeywordRetailer,
): KeywordPair {
  return readRetailerKeywords(getChannelTarget(settings, channelId), retailer);
}

export function getChannelWatchSkus(
  settings: ExtensionSettings,
  channelId: string,
  retailer: WatchSkuRetailer,
): string[] {
  return getChannelTarget(settings, channelId)?.watch_skus?.[retailer] ?? [];
}

export function migrateChannelWatchKeywords(settings: ExtensionSettings): {
  settings: ExtensionSettings;
  changed: boolean;
} {
  let changed = false;
  const channel_targets = settings.channel_targets.map((row) => {
    if (row.watch_keywords !== undefined) {
      return row;
    }
    const legacy = legacyKeywordPair(row);
    if (!legacy) {
      return row;
    }

    changed = true;
    const normalized = normalizeKeywordPair(legacy.positive, legacy.negative);
    const next: ChannelTarget = {
      ...row,
      watch_keywords: {
        target: { ...normalized },
        walmart: { ...normalized },
      },
    };
    delete next.positive_keywords;
    delete next.negative_keywords;
    return next;
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
    watch_keywords: existing?.watch_keywords,
    watch_skus: existing?.watch_skus,
    positive_keywords: existing?.positive_keywords,
    negative_keywords: existing?.negative_keywords,
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
    target_positive_keywords: string[];
    target_negative_keywords: string[];
    walmart_positive_keywords: string[];
    walmart_negative_keywords: string[];
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
  const watch_keywords = buildWatchKeywords(existing, patch);

  return mergeChannelTarget(settings, channelId, {
    allowed_domains: allowedDomains,
    watch_keywords,
    watch_skus,
  });
}

export function upsertChannelKeywords(
  settings: ExtensionSettings,
  channelId: string,
  retailer: WatchKeywordRetailer,
  positive: string[],
  negative: string[],
): ExtensionSettings {
  const domains = getChannelDomains(settings, channelId);
  if (domains.length === 0) {
    throw new Error("Add at least one allowed domain first");
  }
  const existing = getChannelTarget(settings, channelId);
  const targetKw = getChannelKeywords(settings, channelId, "target");
  const walmartKw = getChannelKeywords(settings, channelId, "walmart");

  return upsertChannelDiscordTarget(settings, channelId, {
    allowed_domains: domains,
    target_positive_keywords: retailer === "target" ? positive : targetKw.positive,
    target_negative_keywords: retailer === "target" ? negative : targetKw.negative,
    walmart_positive_keywords: retailer === "walmart" ? positive : walmartKw.positive,
    walmart_negative_keywords: retailer === "walmart" ? negative : walmartKw.negative,
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
