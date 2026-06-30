import { hostMatches } from "@ext/lib/links.ts";

export const WALMART_HOST = "walmart.com";

export function isWalmartUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "walmart.com" || host === "www.walmart.com" || host.endsWith(".walmart.com");
  } catch {
    return false;
  }
}

export function isWalmartHost(hostname: string): boolean {
  return hostMatches(hostname, WALMART_HOST);
}
