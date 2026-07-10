import { MAX_SKUS_PER_LIST } from "@ext/core/lib/constants.ts";
import type { SkuWatchProfile } from "@ext/core/lib/sku-watch/types.ts";

const MIN_TARGET_SKU_LENGTH = 6;
const MAX_TARGET_SKU_LENGTH = 12;

const AUXILIARY_ANCHOR_LABELS = new Set([
  "atc",
  "ebay",
  "amazon",
  "walmart",
  "keepa",
  "selleramp",
  "google",
  "lightningmobile",
  "[lightningmobile]",
]);

const AUXILIARY_HOST_SUFFIXES = [
  "amazon.com",
  "walmart.com",
  "ebay.com",
  "keepa.com",
  "google.com",
] as const;

export function normalizeTargetSku(raw: string): string | null {
  const digits = raw.trim().replace(/\D/g, "");
  if (digits.length < MIN_TARGET_SKU_LENGTH || digits.length > MAX_TARGET_SKU_LENGTH) {
    return null;
  }
  return digits;
}

export function normalizeTargetSkuList(raws: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of raws) {
    const sku = normalizeTargetSku(raw);
    if (!sku || seen.has(sku)) {
      continue;
    }
    seen.add(sku);
    result.push(sku);
    if (result.length >= MAX_SKUS_PER_LIST) {
      break;
    }
  }
  return result;
}

export function buildTargetProductUrlFromSku(sku: string): string {
  return `https://www.target.com/p/-/A-${sku}`;
}

function normalizeAnchorLabel(text: string): string {
  return text.trim().toLowerCase();
}

function hostEndsWith(host: string, suffix: string): boolean {
  const lower = host.toLowerCase();
  const normalized = lower.startsWith("www.") ? lower.slice(4) : lower;
  return normalized === suffix || normalized.endsWith(`.${suffix}`);
}

export function isTargetAuxiliaryLink(href: string, anchorText: string): boolean {
  const label = normalizeAnchorLabel(anchorText);
  if (label && AUXILIARY_ANCHOR_LABELS.has(label)) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return false;
  }

  const host = parsed.hostname;
  const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();

  if (hostEndsWith(host, "goto.target.com")) {
    return true;
  }

  if (hostEndsWith(host, "target.com")) {
    return pathAndQuery.includes("/s?") && pathAndQuery.includes("searchterm=");
  }

  for (const suffix of AUXILIARY_HOST_SUFFIXES) {
    if (hostEndsWith(host, suffix)) {
      return true;
    }
  }

  return false;
}

export const targetSkuWatchProfile: SkuWatchProfile = {
  retailer: "target",
  normalizeSku: normalizeTargetSku,
  isAuxiliaryLink: isTargetAuxiliaryLink,
};
