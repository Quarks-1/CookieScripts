import type { ChannelTarget } from "@ext/types/index.ts";
import { vi } from "vitest";

export function buildChannelTarget(overrides: Partial<ChannelTarget> = {}): ChannelTarget {
  return {
    channel_id: "1234567890123456789",
    allowed_domains: ["walmart.com"],
    ...overrides,
  };
}

export function mockContentSender(overrides: {
  tabId?: number;
  tabUrl?: string;
  extensionId?: string;
} = {}): chrome.runtime.MessageSender {
  const extensionId = overrides.extensionId ?? "test-extension-id";
  const tabId = overrides.tabId ?? 1;
  const tabUrl = overrides.tabUrl ?? "https://discord.com/channels/111/222";
  return {
    id: extensionId,
    tab: {
      id: tabId,
      url: tabUrl,
    } as chrome.tabs.Tab,
  };
}

export function mockExtensionPageSender(extensionId = "test-extension-id"): chrome.runtime.MessageSender {
  return {
    id: extensionId,
    url: `chrome-extension://${extensionId}/ui/popup/index.html`,
  };
}

export function mockRetailerContentSender(overrides: {
  tabId?: number;
  tabUrl?: string;
  extensionId?: string;
} = {}): chrome.runtime.MessageSender {
  const extensionId = overrides.extensionId ?? "test-extension-id";
  const tabId = overrides.tabId ?? 2;
  const tabUrl = overrides.tabUrl ?? "https://www.target.com/p/foo/-/A-123";
  return {
    id: extensionId,
    tab: {
      id: tabId,
      url: tabUrl,
    } as chrome.tabs.Tab,
  };
}

export function mockChromeSessionStorage() {
  const storage: Record<string, unknown> = {};

  const sessionApi = {
    get: vi.fn(async (keys: string | string[] | null) => {
      if (keys === null) {
        return { ...storage };
      }
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
    clear: vi.fn(async () => {
      for (const key of Object.keys(storage)) {
        delete storage[key];
      }
    }),
  };

  const existingChrome = (globalThis as { chrome?: typeof chrome }).chrome;

  vi.stubGlobal("chrome", {
    ...existingChrome,
    runtime: existingChrome?.runtime ?? {},
    storage: {
      ...existingChrome?.storage,
      session: sessionApi,
    },
  });

  return { storage, sessionApi };
}
