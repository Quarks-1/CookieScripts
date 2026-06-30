import { domainFromUrl } from "@ext/core/lib/domains.ts";
import { unwrapAffiliateUrl } from "@ext/core/lib/affiliate-unwrap.ts";
import { normalizeHost } from "@ext/core/lib/links.ts";

/** Map CDN, vanity, and affiliate hosts to the retailer domain users care about. */
const CANONICAL_SUFFIXES: Array<{ suffix: string; canonical: string }> = [
  { suffix: "walmartimages.com", canonical: "walmart.com" },
  { suffix: "goto.walmart.com", canonical: "walmart.com" },
  { suffix: "goto.target.com", canonical: "target.com" },
  { suffix: "media-amazon.com", canonical: "amazon.com" },
  { suffix: "ssl-images-amazon.com", canonical: "amazon.com" },
  { suffix: "images-amazon.com", canonical: "amazon.com" },
];

export function canonicalizeSuggestionDomain(domain: string): string {
  const host = normalizeHost(domain);
  for (const { suffix, canonical } of CANONICAL_SUFFIXES) {
    if (host === suffix || host.endsWith("." + suffix)) {
      return canonical;
    }
  }
  return host;
}

export function suggestionDomainFromUrl(url: string): string | null {
  const domain = domainFromUrl(unwrapAffiliateUrl(url));
  if (!domain) {
    return null;
  }
  return canonicalizeSuggestionDomain(domain);
}
