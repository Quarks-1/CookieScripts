import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { EXTENSION_ID, setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { buildChannelTarget, mockContentSender, mockExtensionPageSender } from "../fixtures/fixtures.ts";

describe("handleMessage — discord", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupChromeMocks();
    recentUrlKeys.clear();
    activeChannels.clear();
    await initRuntimeState();
  });

  it("rejects CANDIDATE_LINKS when channel_id spoofs tab url", async () => {
    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "9999999999999999999",
        urls: ["https://walmart.com/item"],
      },
      sender,
    );

    expect(response).toEqual({ ok: false, error: "Invalid channel" });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("opens allowlisted links for matching channel", async () => {
    const settings = {
      enabled: true,
      channel_targets: [buildChannelTarget({ channel_id: "222", allowed_domains: ["walmart.com"] })],
    };
    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (items: Record<string, unknown>) => {
        if (items["cookiescripts:settings"]) {
          await chrome.storage.local.get("cookiescripts:settings");
        }
      },
    );
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key === "cookiescripts:settings") {
          result[key] = settings;
        } else if (key === "cookiescripts:history") {
          result[key] = [];
        } else if (key === "cookiescripts:recentUrls") {
          result[key] = [];
        }
      }
      return result;
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: ["https://walmart.com/item"],
        author: "alice",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: ["https://walmart.com/item"],
      duplicates: [],
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://walmart.com/item",
      active: false,
    });
  });

  it("does not open links when channel has no allowlist", async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key === "cookiescripts:settings") {
          result[key] = DEFAULT_SETTINGS;
        }
      }
      return result;
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: ["https://walmart.com/item"],
      },
      sender,
    );

    expect(response).toEqual({ ok: true, opened: [], duplicates: [] });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("returns WATCH_CONFIG with channel_id when enabled and no domains configured", async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key === "cookiescripts:settings") {
          result[key] = DEFAULT_SETTINGS;
        }
      }
      return result;
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      { type: "CHANNEL_ACTIVE", channel_id: "222" },
      sender,
    );

    expect(response).toEqual({
      type: "WATCH_CONFIG",
      channel_id: "222",
      allowed_domains: [],
    });
    expect(activeChannels.get(1)).toBe("222");
  });

  it("returns WATCH_CONFIG from derived channel on CHANNEL_ACTIVE", async () => {
    const settings = {
      enabled: true,
      channel_targets: [buildChannelTarget({ channel_id: "222", allowed_domains: ["walmart.com"] })],
    };
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key === "cookiescripts:settings") {
          result[key] = settings;
        }
      }
      return result;
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      { type: "CHANNEL_ACTIVE", channel_id: "222" },
      sender,
    );

    expect(response).toEqual({
      type: "WATCH_CONFIG",
      channel_id: "222",
      allowed_domains: ["walmart.com"],
    });
    expect(activeChannels.get(1)).toBe("222");
  });

  it("adds an allowed domain from content script", async () => {
    const storage: Record<string, unknown> = {
      "cookiescripts:settings": DEFAULT_SETTINGS,
    };
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (storage[key] !== undefined) {
          result[key] = storage[key];
        }
      }
      return result;
    });
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      Object.assign(storage, items);
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      { type: "ADD_ALLOWED_DOMAIN", channel_id: "222", domain: "walmart.com" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:settings"]).toEqual({
      enabled: true,
      channel_targets: [{ channel_id: "222", allowed_domains: ["walmart.com"] }],
    });
  });

  it("stores ignored domains from content script", async () => {
    const storage: Record<string, unknown> = {};
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (storage[key] !== undefined) {
          result[key] = storage[key];
        }
      }
      return result;
    });
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      Object.assign(storage, items);
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      { type: "IGNORE_DOMAIN", channel_id: "222", domain: "spam.com" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(storage["cookiescripts:ignoredDomains"]).toEqual({ "222": ["spam.com"] });
  });

  it("returns detected domains from the active discord tab", async () => {
    const sender = mockExtensionPageSender(EXTENSION_ID);

    const response = await handleMessage({ type: "GET_DETECTED_DOMAINS" }, sender);

    expect(response).toEqual({ ok: true, domains: ["walmart.com"] });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: "SCAN_DETECTED_DOMAINS" });
  });
});
