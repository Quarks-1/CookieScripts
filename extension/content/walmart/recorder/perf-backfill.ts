import { redactUrl, parseGraphqlOperation } from "@ext/lib/walmart/url.ts";
import type { WalmartRecordingEvent } from "@ext/types/walmart.ts";

const MAX_RESOURCE_BACKFILL = 40;
const WALMART_ORIGIN = "https://www.walmart.com";

export function isResearchResourceUrl(url: string, base = WALMART_ORIGIN): boolean {
  try {
    const parsed = new URL(url, base);
    if (!parsed.hostname.endsWith("walmart.com")) {
      return false;
    }
    const path = parsed.pathname;
    return (
      path.includes("/orchestra/") ||
      path.includes("/graphql") ||
      path.includes("/swag/") ||
      path.startsWith("/api/")
    );
  } catch {
    return false;
  }
}

export function collectResourceTimingEvents(sinceMs = 0): WalmartRecordingEvent[] {
  if (typeof performance === "undefined" || !("getEntriesByType" in performance)) {
    return [];
  }

  const events: WalmartRecordingEvent[] = [];
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  for (const entry of entries) {
    if (entry.startTime < sinceMs) {
      continue;
    }
    if (!isResearchResourceUrl(entry.name)) {
      continue;
    }
    const absoluteUrl = redactUrl(entry.name, WALMART_ORIGIN);
    events.push({
      kind: "network",
      ts: new Date(performance.timeOrigin + entry.responseEnd).toISOString(),
      transport: "resource",
      method: "GET",
      url: entry.name,
      absoluteUrl,
      graphqlOperation: parseGraphqlOperation(entry.name, WALMART_ORIGIN),
      durationMs: Math.round(entry.duration),
      status: entry.transferSize > 0 || entry.decodedBodySize > 0 ? 200 : undefined,
    });
    if (events.length >= MAX_RESOURCE_BACKFILL) {
      break;
    }
  }
  return events;
}
