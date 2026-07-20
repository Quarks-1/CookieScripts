import { hostMatches } from "@ext/core/lib/links.ts";

export const SAMSCLUB_HOST = "samsclub.com";

export function isSamsclubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "samsclub.com" || host === "www.samsclub.com" || host.endsWith(".samsclub.com");
  } catch {
    return false;
  }
}

export function isSamsclubHost(hostname: string): boolean {
  return hostMatches(hostname, SAMSCLUB_HOST);
}

export function isSamsclubProductUrl(url: string): boolean {
  if (!isSamsclubUrl(url)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return /\/ip\/[^/]+\/\d+/.test(parsed.pathname);
  } catch {
    return false;
  }
}
