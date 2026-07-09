import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import {
  clearRetailerRuntimeState,
  releaseRetailerJob,
  tryAcquireRetailerJob,
} from "@ext/domains/target/background/runtime-state.ts";
import { EXTENSION_ID, setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { buildChannelTarget, mockContentSender } from "../fixtures/fixtures.ts";

describe("handleMessage — target", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupChromeMocks();
    clearRetailerRuntimeState();
    recentUrlKeys.clear();
    activeChannels.clear();
    await initRuntimeState();
  });

  it("opens target product links in a new window when retailer auto mode is enabled", async () => {
    const settings = {
      enabled: true,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
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
        urls: ["https://www.target.com/p/foo/-/A-123"],
        author: "alice",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: ["https://www.target.com/p/foo/-/A-123"],
    });
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: "https://www.target.com/p/foo/-/A-123",
      focused: true,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ type: "RETAILER_START_AUTO", channel_id: "222" }),
    );
  });

  it("opens a passive window when retailer auto mode job is already in progress", async () => {
    const settings = {
      enabled: true,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
    const storage = {
      "cookiescripts:settings": settings,
      "cookiescripts:history": [],
      "cookiescripts:recentUrls": [],
    };
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (storage[key as keyof typeof storage] !== undefined) {
          result[key] = storage[key as keyof typeof storage];
        }
      }
      return result;
    });
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      Object.assign(storage, items);
    });

    tryAcquireRetailerJob("222");

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: ["https://www.target.com/p/foo/-/A-123"],
        author: "alice",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: ["https://www.target.com/p/foo/-/A-123"],
    });
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: "https://www.target.com/p/foo/-/A-123",
      focused: false,
    });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(storage["cookiescripts:history"]).toEqual([
      expect.objectContaining({
        kind: "retailer_auto_queued",
        url: "https://www.target.com/p/foo/-/A-123",
        channel_id: "222",
        error: "Auto mode skipped — job in progress",
      }),
    ]);
    releaseRetailerJob("222");
  });

  it("opens a passive tab when retailer auto mode job is queued and open_links_in_window is false", async () => {
    const settings = {
      enabled: true,
      open_links_in_window: false,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
    const storage = {
      "cookiescripts:settings": settings,
      "cookiescripts:history": [],
      "cookiescripts:recentUrls": [],
    };
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (storage[key as keyof typeof storage] !== undefined) {
          result[key] = storage[key as keyof typeof storage];
        }
      }
      return result;
    });
    vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
      Object.assign(storage, items);
    });

    tryAcquireRetailerJob("222");

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: ["https://www.target.com/p/foo/-/A-123"],
        author: "alice",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: ["https://www.target.com/p/foo/-/A-123"],
    });
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://www.target.com/p/foo/-/A-123",
      active: false,
    });
    expect(chrome.windows.create).not.toHaveBeenCalled();
    releaseRetailerJob("222");
  });

  it("does not open target window on negative-only keyword match", async () => {
    const storage: Record<string, unknown> = {
      "cookiescripts:settings": {
        enabled: true,
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["target.com"],
            retailer_auto_atc_enabled: true,
            negative_keywords: ["chaos rising"],
          }),
        ],
      },
      "cookiescripts:history": [],
      "cookiescripts:recentUrls": [],
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
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: ["https://www.target.com/p/foo/-/A-123"],
        message_text: "restock chaos rising today",
      },
      sender,
    );

    expect(response).toEqual({ ok: true, opened: [], duplicates: [] });
    expect(chrome.windows.create).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(storage["cookiescripts:history"]).toEqual([
      expect.objectContaining({
        kind: "keyword_skipped",
        url: "https://www.target.com/p/foo/-/A-123",
      }),
    ]);
  });
});
