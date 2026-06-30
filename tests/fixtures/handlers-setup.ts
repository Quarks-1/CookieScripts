import { vi } from "vitest";

import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";

export const EXTENSION_ID = "test-extension-id";

export function setupChromeMocks() {
  const storage: Record<string, unknown> = {
    "cookiescripts:settings": DEFAULT_SETTINGS,
    "cookiescripts:history": [],
    "cookiescripts:recentUrls": [],
  };

  vi.stubGlobal("chrome", {
    runtime: {
      id: EXTENSION_ID,
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
    tabs: {
      create: vi.fn(async () => ({ id: 99 })),
      query: vi.fn(async () => [{ id: 1, url: "https://discord.com/channels/111/222" }]),
      sendMessage: vi.fn(async () => ({ ok: true, domains: ["walmart.com"] })),
      onRemoved: { addListener: vi.fn() },
      get: vi.fn(async () => ({ id: 99, status: "complete" })),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    windows: {
      create: vi.fn(async () => ({ id: 10, tabs: [{ id: 99 }] })),
      getLastFocused: vi.fn(async () => ({ id: 1 })),
      getCurrent: vi.fn(async () => ({ id: 1 })),
      onRemoved: { addListener: vi.fn() },
    },
  });

  return storage;
}
