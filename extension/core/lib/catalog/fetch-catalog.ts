import { CATALOG_RAW_URL, STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import type { CatalogData } from "@ext/core/types/index.ts";

import { parseCatalog } from "./parse.ts";

export type CatalogLoadSource = "remote" | "cache" | "bundled";

export interface CatalogLoadResult {
  catalog: CatalogData;
  source: CatalogLoadSource;
}

export interface CatalogCache {
  fetchedAt: number;
  etag: string | null;
  raw: unknown;
}

async function readCache(): Promise<CatalogCache | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.catalogCache);
  return (result[STORAGE_KEYS.catalogCache] as CatalogCache | undefined) ?? null;
}

async function writeCache(cache: CatalogCache): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.catalogCache]: cache });
}

function tryParseCatalog(raw: unknown): CatalogData | null {
  try {
    return parseCatalog(raw);
  } catch {
    return null;
  }
}

async function fetchRemoteCatalog(
  etag: string | null,
): Promise<{ status: number; raw: unknown; etag: string | null } | null> {
  const headers: Record<string, string> = {};
  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const response = await fetch(CATALOG_RAW_URL, { headers });
  if (response.status === 304) {
    return { status: 304, raw: null, etag };
  }
  if (response.status !== 200) {
    return null;
  }

  const raw = await response.json();
  return {
    status: 200,
    raw,
    etag: response.headers.get("etag"),
  };
}

export async function resolveCatalog(bundledRaw: unknown): Promise<CatalogLoadResult> {
  const cache = await readCache();

  try {
    const result = await fetchRemoteCatalog(cache?.etag ?? null);
    if (result?.status === 304 && cache) {
      const parsed = tryParseCatalog(cache.raw);
      if (parsed) {
        return { catalog: parsed, source: "remote" };
      }
    } else if (result?.status === 200) {
      const parsed = tryParseCatalog(result.raw);
      if (parsed) {
        await writeCache({
          fetchedAt: Date.now(),
          etag: result.etag,
          raw: result.raw,
        });
        return { catalog: parsed, source: "remote" };
      }
    }
  } catch {
    // Fall through to cache or bundled fallback.
  }

  if (cache) {
    const parsed = tryParseCatalog(cache.raw);
    if (parsed) {
      return { catalog: parsed, source: "cache" };
    }
  }

  return { catalog: parseCatalog(bundledRaw), source: "bundled" };
}

export async function clearCatalogCache(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.catalogCache);
}
