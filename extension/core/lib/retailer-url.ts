import { isRetailerUrl } from "@ext/domains/target/lib/index.ts";
import { isWalmartUrl } from "@ext/domains/walmart/lib/index.ts";

export type WatchKeywordRetailer = "target" | "walmart";

export function resolveWatchKeywordRetailer(url: string): WatchKeywordRetailer | null {
  if (isWalmartUrl(url)) {
    return "walmart";
  }
  if (isRetailerUrl(url)) {
    return "target";
  }
  return null;
}

export function partitionUrlsByRetailer(urls: string[]): {
  target: string[];
  walmart: string[];
  other: string[];
} {
  const target: string[] = [];
  const walmart: string[] = [];
  const other: string[] = [];

  for (const url of urls) {
    const retailer = resolveWatchKeywordRetailer(url);
    if (retailer === "target") {
      target.push(url);
    } else if (retailer === "walmart") {
      walmart.push(url);
    } else {
      other.push(url);
    }
  }

  return { target, walmart, other };
}
