import type { EndpointCatalogEntry } from "@ext/domains/walmart/types/walmart.ts";
import { resolveAbsoluteUrl } from "@ext/domains/walmart/lib/url.ts";

export function normalizePathname(pathname: string): string {
  return pathname
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":uuid");
}

export function endpointKey(_method: string, url: string, base?: string): { host: string; pathnamePattern: string; graphqlOperation?: string } | null {
  try {
    const absolute = resolveAbsoluteUrl(url, base);
    const parsed = new URL(absolute);
    const graphqlMatch = parsed.pathname.match(/\/graphql\/([^/]+)\//);
    return {
      host: parsed.hostname,
      pathnamePattern: normalizePathname(parsed.pathname),
      graphqlOperation: graphqlMatch?.[1],
    };
  } catch {
    return null;
  }
}

export function upsertEndpoint(
  catalog: EndpointCatalogEntry[],
  method: string,
  url: string,
  ts: string,
  sampleRequestBody?: string,
  base?: string,
): EndpointCatalogEntry[] {
  const absolute = resolveAbsoluteUrl(url, base);
  const key = endpointKey(method, absolute);
  if (!key) {
    return catalog;
  }
  const existing = catalog.find(
    (entry) =>
      entry.method === method &&
      entry.host === key.host &&
      entry.pathnamePattern === key.pathnamePattern &&
      (entry.graphqlOperation ?? undefined) === (key.graphqlOperation ?? undefined),
  );
  if (existing) {
    return catalog.map((entry) =>
      entry === existing
        ? {
            ...entry,
            count: entry.count + 1,
            lastSeen: ts,
            sampleRequestBody: entry.sampleRequestBody ?? sampleRequestBody,
          }
        : entry,
    );
  }
  return [
    ...catalog,
    {
      method,
      host: key.host,
      pathnamePattern: key.pathnamePattern,
      graphqlOperation: key.graphqlOperation,
      count: 1,
      firstSeen: ts,
      lastSeen: ts,
      sampleRequestBody,
    },
  ];
}

export function markerSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatDropDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatSessionTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}${m}${s}`;
}
