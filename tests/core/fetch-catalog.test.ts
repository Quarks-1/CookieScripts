import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCatalogCache,
  resolveCatalog,
} from "@ext/core/lib/catalog/fetch-catalog.ts";
import { CATALOG_RAW_URL, STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { parseCatalog } from "@ext/core/lib/catalog/parse.ts";

function minimalCatalog() {
  return {
    schema_version: 1,
    product_types: ["booster_box"],
    sets: [{ id: "test-set", name: "Test Set" }],
    products: [
      {
        id: "test-product",
        name: "Test Product",
        type: "booster_box",
        msrp_cents: 999,
        contents: [{ set_id: "test-set", packs: 1 }],
        listings: [{ retailer: "target", sku: "12345678" }],
      },
    ],
  };
}

function setupChromeMocks() {
  const storage: Record<string, unknown> = {};

  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (storage[key] !== undefined) {
              result[key] = storage[key];
            }
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete storage[key];
          }
        }),
      },
    },
  });

  return storage;
}

function mockCatalogResponse(
  raw: unknown,
  status = 200,
  etag: string | null = '"catalog-etag"',
) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => (name.toLowerCase() === "etag" ? etag : null),
    },
    json: async () => raw,
  };
}

describe("resolveCatalog", () => {
  const bundled = minimalCatalog();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed data and writes cache on fresh 200 with valid catalog", async () => {
    const storage = setupChromeMocks();
    const remote = minimalCatalog();
    remote.products[0].name = "Remote Product";

    const fetchMock = vi.fn().mockResolvedValue(mockCatalogResponse(remote));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCatalog(bundled);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.source).toBe("remote");
    expect(result.catalog.products[0].name).toBe("Remote Product");
    expect(storage[STORAGE_KEYS.catalogCache]).toMatchObject({
      etag: '"catalog-etag"',
      raw: remote,
    });
    expect(
      (storage[STORAGE_KEYS.catalogCache] as { fetchedAt: number }).fetchedAt,
    ).toEqual(expect.any(Number));
  });

  it("writes cache with etag null when 200 has no ETag header", async () => {
    const storage = setupChromeMocks();
    const remote = minimalCatalog();

    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockCatalogResponse(remote, 200, null));
    vi.stubGlobal("fetch", fetchMock);

    await resolveCatalog(bundled);

    expect(storage[STORAGE_KEYS.catalogCache]).toMatchObject({
      etag: null,
      raw: remote,
    });
  });

  it("returns cached data unchanged on 304 with valid cache", async () => {
    const storage = setupChromeMocks();
    const cached = minimalCatalog();
    cached.products[0].name = "Cached Product";
    const fetchedAt = Date.now() - 60_000;
    storage[STORAGE_KEYS.catalogCache] = {
      fetchedAt,
      etag: '"current-etag"',
      raw: cached,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      status: 304,
      ok: false,
      headers: { get: () => '"current-etag"' },
      json: async () => {
        throw new Error("304 responses have no body");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCatalog(bundled);

    expect(result.source).toBe("remote");
    expect(result.catalog.products[0].name).toBe("Cached Product");
    expect(storage[STORAGE_KEYS.catalogCache]).toEqual({
      fetchedAt,
      etag: '"current-etag"',
      raw: cached,
    });
  });

  it("falls back to bundled on 304 with missing cache", async () => {
    setupChromeMocks();

    const fetchMock = vi.fn().mockResolvedValue({
      status: 304,
      ok: false,
      headers: { get: () => '"missing-cache-etag"' },
      json: async () => {
        throw new Error("304 responses have no body");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCatalog(bundled);

    expect(result.source).toBe("bundled");
    expect(result.catalog).toEqual(parseCatalog(bundled));
  });

  it("returns cached data on network error when cache is valid", async () => {
    const storage = setupChromeMocks();
    const cached = minimalCatalog();
    cached.products[0].name = "Cached Product";
    storage[STORAGE_KEYS.catalogCache] = {
      fetchedAt: Date.now() - 60_000,
      etag: '"current-etag"',
      raw: cached,
    };

    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCatalog(bundled);

    expect(result.source).toBe("cache");
    expect(result.catalog.products[0].name).toBe("Cached Product");
    expect(storage[STORAGE_KEYS.catalogCache]).toMatchObject({ raw: cached });
  });

  it("returns bundled fallback on network error with no cache", async () => {
    setupChromeMocks();

    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCatalog(bundled);

    expect(result.source).toBe("bundled");
    expect(result.catalog).toEqual(parseCatalog(bundled));
  });

  it("does not update cache and falls back when remote JSON is invalid", async () => {
    const storage = setupChromeMocks();
    const cached = minimalCatalog();
    cached.products[0].name = "Cached Product";
    const fetchedAt = Date.now() - 60_000;
    storage[STORAGE_KEYS.catalogCache] = {
      fetchedAt,
      etag: '"current-etag"',
      raw: cached,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockCatalogResponse({ schema_version: 99 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCatalog(bundled);

    expect(result.source).toBe("cache");
    expect(result.catalog.products[0].name).toBe("Cached Product");
    expect(storage[STORAGE_KEYS.catalogCache]).toEqual({
      fetchedAt,
      etag: '"current-etag"',
      raw: cached,
    });
  });

  it("sends If-None-Match when cache has etag", async () => {
    const storage = setupChromeMocks();
    const cached = minimalCatalog();
    storage[STORAGE_KEYS.catalogCache] = {
      fetchedAt: Date.now() - 60_000,
      etag: '"current-etag"',
      raw: cached,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      status: 304,
      ok: false,
      headers: { get: () => '"current-etag"' },
      json: async () => {
        throw new Error("304 responses have no body");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await resolveCatalog(bundled);

    expect(fetchMock).toHaveBeenCalledWith(CATALOG_RAW_URL, {
      headers: { "If-None-Match": '"current-etag"' },
    });
  });
});

describe("clearCatalogCache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes catalogCache from storage", async () => {
    const storage = setupChromeMocks();
    storage[STORAGE_KEYS.catalogCache] = {
      fetchedAt: Date.now(),
      etag: '"etag"',
      raw: minimalCatalog(),
    };

    await clearCatalogCache();

    expect(storage[STORAGE_KEYS.catalogCache]).toBeUndefined();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(STORAGE_KEYS.catalogCache);
  });
});
