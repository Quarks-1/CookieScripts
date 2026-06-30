export { unwrapAffiliateUrl } from "@ext/core/lib/affiliate-unwrap.ts";

import { unwrapAffiliateUrl } from "@ext/core/lib/affiliate-unwrap.ts";

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;
const TRAILING_PUNCTUATION = ".,;:!?)]}'\"";

export function normalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

export function hostMatches(host: string, allowed: string): boolean {
  const normalizedHost = normalizeHost(host);
  const normalizedAllowed = normalizeHost(allowed);
  return normalizedHost === normalizedAllowed || normalizedHost.endsWith("." + normalizedAllowed);
}

export function normalizeUrlForDedup(url: string): string {
  const unwrapped = unwrapAffiliateUrl(url);
  let parsed: URL;
  try {
    parsed = new URL(unwrapped);
  } catch {
    return unwrapped;
  }
  const path = parsed.pathname.replace(/\/$/, "") || "";
  return `${parsed.protocol.toLowerCase()}//${normalizeHost(parsed.hostname)}${path}`;
}

export function stripTrailingPunctuation(url: string): string {
  let result = url;
  while (result.length > 0 && TRAILING_PUNCTUATION.includes(result.at(-1)!)) {
    result = result.slice(0, -1);
  }
  return result;
}

export function extractUrls(text: string): string[] {
  if (!text) {
    return [];
  }
  const seen = new Map<string, null>();
  for (const match of text.matchAll(URL_PATTERN)) {
    const cleaned = stripTrailingPunctuation(match[0]);
    if (cleaned) {
      seen.set(cleaned, null);
    }
  }
  return [...seen.keys()];
}

export function filterUrlsByDomains(urls: string[], allowedDomains: string[]): string[] {
  if (!allowedDomains.length) {
    return [];
  }
  const matched = new Map<string, null>();
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    if (!host) {
      continue;
    }
    if (allowedDomains.some((domain) => hostMatches(host, domain))) {
      matched.set(url, null);
    }
  }
  return [...matched.keys()];
}

export function isHttpOrHttpsUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
