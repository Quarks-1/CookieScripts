import { MAX_KEYWORD_LENGTH, MAX_KEYWORDS_PER_LIST, MAX_SKU_LENGTH, MAX_SKUS_PER_LIST } from "@ext/core/lib/constants.ts";
import type { ChannelTarget } from "@ext/core/types/index.ts";

function validateChannelId(channelId: string): string | null {
  if (!/^\d+$/.test(channelId)) {
    return "Each channel ID must be a numeric Discord channel ID";
  }
  try {
    if (BigInt(channelId) <= 0n) {
      return "Each channel ID must be a positive integer";
    }
  } catch {
    return "Each channel ID must be a numeric Discord channel ID";
  }
  return null;
}

function validateKeywordList(
  keywords: string[] | undefined,
  fieldName: string,
): string | null {
  if (keywords === undefined) {
    return null;
  }
  if (!Array.isArray(keywords)) {
    return `${fieldName} must be an array`;
  }
  if (keywords.length > MAX_KEYWORDS_PER_LIST) {
    return `${fieldName} must have at most ${MAX_KEYWORDS_PER_LIST} entries`;
  }
  for (const keyword of keywords) {
    if (typeof keyword !== "string" || keyword.length === 0) {
      return `${fieldName} entries must be non-empty strings`;
    }
    if (keyword.length > MAX_KEYWORD_LENGTH) {
      return `${fieldName} entries must be at most ${MAX_KEYWORD_LENGTH} characters`;
    }
  }
  return null;
}

function validateSkuList(skus: string[] | undefined, fieldName: string): string | null {
  if (skus === undefined) {
    return null;
  }
  if (!Array.isArray(skus)) {
    return `${fieldName} must be an array`;
  }
  if (skus.length > MAX_SKUS_PER_LIST) {
    return `${fieldName} must have at most ${MAX_SKUS_PER_LIST} entries`;
  }
  for (const sku of skus) {
    if (typeof sku !== "string" || sku.length === 0) {
      return `${fieldName} entries must be non-empty strings`;
    }
    if (sku.length > MAX_SKU_LENGTH) {
      return `${fieldName} entries must be at most ${MAX_SKU_LENGTH} characters`;
    }
    if (!/^\d+$/.test(sku)) {
      return `${fieldName} entries must be digits only`;
    }
  }
  return null;
}

function validateKeywordOverlap(target: ChannelTarget): string | null {
  const positive = target.positive_keywords ?? [];
  const negative = target.negative_keywords ?? [];
  if (positive.length === 0 || negative.length === 0) {
    return null;
  }
  const negativeSet = new Set(negative);
  for (const keyword of positive) {
    if (negativeSet.has(keyword)) {
      return "positive_keywords and negative_keywords must not overlap";
    }
  }
  return null;
}

export function validateChannelTarget(target: ChannelTarget): string | null {
  const idError = validateChannelId(target.channel_id);
  if (idError) {
    return idError;
  }
  if (!target.allowed_domains.length) {
    return "Each channel needs at least one allowed domain";
  }
  if (
    target.retailer_auto_atc_enabled !== undefined &&
    typeof target.retailer_auto_atc_enabled !== "boolean"
  ) {
    return "retailer_auto_atc_enabled must be a boolean";
  }
  if (target.retailer_refresh_interval_sec !== undefined) {
    if (
      typeof target.retailer_refresh_interval_sec !== "number" ||
      !Number.isFinite(target.retailer_refresh_interval_sec) ||
      target.retailer_refresh_interval_sec <= 0 ||
      target.retailer_refresh_interval_sec > 3600
    ) {
      return "retailer_refresh_interval_sec must be between 1 and 3600";
    }
  }
  const positiveError = validateKeywordList(target.positive_keywords, "positive_keywords");
  if (positiveError) {
    return positiveError;
  }
  const negativeError = validateKeywordList(target.negative_keywords, "negative_keywords");
  if (negativeError) {
    return negativeError;
  }
  const targetSkusError = validateSkuList(target.watch_skus?.target, "watch_skus.target");
  if (targetSkusError) {
    return targetSkusError;
  }
  const walmartSkusError = validateSkuList(target.watch_skus?.walmart, "watch_skus.walmart");
  if (walmartSkusError) {
    return walmartSkusError;
  }
  return validateKeywordOverlap(target);
}

export function validatePersistedTargets(targets: ChannelTarget[]): string | null {
  const seen = new Set<string>();
  for (const target of targets) {
    const error = validateChannelTarget(target);
    if (error) {
      return error;
    }
    if (seen.has(target.channel_id)) {
      return "Channel IDs must be unique";
    }
    seen.add(target.channel_id);
  }
  return null;
}
