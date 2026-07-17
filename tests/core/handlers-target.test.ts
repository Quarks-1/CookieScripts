import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { clearRetailerRuntimeState } from "@ext/domains/target/background/runtime-state.ts";
import { EXTENSION_ID, setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { buildChannelTarget, mockContentSender } from "../fixtures/fixtures.ts";

const PRODUCT_URL = "https://www.target.com/p/foo/-/A-123";

function mockSettingsStorage(settings: Record<string, unknown>) {
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
  return storage;
}

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
    mockSettingsStorage({
      enabled: true,
      retailer_auto_atc_enabled: true,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
        }),
      ],
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: [PRODUCT_URL],
        author: "alice",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: [PRODUCT_URL],
    });
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: PRODUCT_URL,
      focused: true,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ type: "RETAILER_START_AUTO", channel_id: "222" }),
    );
  });

  it("opens target product links repeatedly when retailer_link_open_count is 3", async () => {
    const storage = mockSettingsStorage({
      enabled: true,
      retailer_link_open_count: 3,
      retailer_auto_atc_enabled: true,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
        }),
      ],
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: [PRODUCT_URL],
        author: "alice",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: [PRODUCT_URL, PRODUCT_URL, PRODUCT_URL],
    });
    expect(chrome.windows.create).toHaveBeenCalledTimes(3);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(3);
    expect(storage["cookiescripts:history"]).toHaveLength(3);
    expect(storage["cookiescripts:history"]).toEqual([
      expect.objectContaining({ kind: "retailer_window_opened", url: PRODUCT_URL }),
      expect.objectContaining({ kind: "retailer_window_opened", url: PRODUCT_URL }),
      expect.objectContaining({ kind: "retailer_window_opened", url: PRODUCT_URL }),
    ]);
  });

  it("does not open target window on negative-only keyword match", async () => {
    const storage = mockSettingsStorage({
      enabled: true,
      retailer_auto_atc_enabled: true,
      watch_keywords: {
        target: { negative: ["chaos rising"] },
      },
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
        }),
      ],
    });

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: [PRODUCT_URL],
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
        url: PRODUCT_URL,
      }),
    ]);
  });
});
