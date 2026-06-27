import { unwrapAffiliateUrl } from "@ext/lib/affiliate-unwrap.ts";
import { hostMatches } from "@ext/lib/links.ts";

export const RETAILER_HOST = "target.com";

export function isRetailerUrl(url: string): boolean {
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    return hostMatches(parsed.hostname, RETAILER_HOST);
  } catch {
    return false;
  }
}

export function isRetailerProductUrl(url: string): boolean {
  if (!isRetailerUrl(url)) {
    return false;
  }
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    return parsed.pathname.includes("/p/");
  } catch {
    return false;
  }
}

export function allowlistIncludesRetailerHost(domains: string[]): boolean {
  return domains.some((domain) => hostMatches(domain, RETAILER_HOST));
}
