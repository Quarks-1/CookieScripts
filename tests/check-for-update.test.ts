import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkForUpdate } from "@ext/lib/check-for-update.ts";
import { STORAGE_KEYS } from "@ext/lib/constants.ts";

const RELEASE_URL = "https://github.com/Quarks-1/CookieScripts/releases/tag/v0.1.2";

function setupChromeMocks(installedVersion = "0.1.1") {
  const storage: Record<string, unknown> = {};

  vi.stubGlobal("chrome", {
    runtime: {
      getManifest: () => ({ version: installedVersion }),
    },
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
      },
    },
  });

  return storage;
}

function mockReleaseResponse(tagName: string, status = 200, etag = '"release-etag"') {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => (name.toLowerCase() === "etag" ? etag : null),
    },
    json: async () => ({
      tag_name: tagName,
      html_url: RELEASE_URL,
      draft: false,
      prerelease: false,
    }),
  };
}

describe("checkForUpdate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks GitHub even when a recent cache entry exists", async () => {
    const storage = setupChromeMocks("0.1.1");
    storage[STORAGE_KEYS.updateCheck] = {
      checkedAt: Date.now(),
      latestVersion: "0.1.1",
      releaseUrl: "https://github.com/Quarks-1/CookieScripts/releases/tag/v0.1.1",
      etag: '"old-etag"',
    };

    const fetchMock = vi.fn().mockResolvedValue(mockReleaseResponse("v0.1.2"));
    vi.stubGlobal("fetch", fetchMock);

    const info = await checkForUpdate();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(info).toEqual({
      latestVersion: "0.1.2",
      releaseUrl: RELEASE_URL,
    });
  });

  it("reuses cached release data on 304 responses", async () => {
    const storage = setupChromeMocks("0.1.1");
    storage[STORAGE_KEYS.updateCheck] = {
      checkedAt: Date.now() - 60_000,
      latestVersion: "0.1.2",
      releaseUrl: RELEASE_URL,
      etag: '"current-etag"',
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

    const info = await checkForUpdate();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(info).toEqual({
      latestVersion: "0.1.2",
      releaseUrl: RELEASE_URL,
    });
  });

  it("does not clear cached release data when GitHub returns an error", async () => {
    const storage = setupChromeMocks("0.1.1");
    const checkedAt = Date.now() - 60_000;
    storage[STORAGE_KEYS.updateCheck] = {
      checkedAt,
      latestVersion: "0.1.2",
      releaseUrl: RELEASE_URL,
      etag: '"current-etag"',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      headers: { get: () => null },
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const info = await checkForUpdate();

    expect(info).toEqual({
      latestVersion: "0.1.2",
      releaseUrl: RELEASE_URL,
    });
    expect(storage[STORAGE_KEYS.updateCheck]).toEqual({
      checkedAt,
      latestVersion: "0.1.2",
      releaseUrl: RELEASE_URL,
      etag: '"current-etag"',
    });
  });
});
