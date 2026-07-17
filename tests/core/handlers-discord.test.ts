import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
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
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: "https://walmart.com/item",
      focused: false,
    });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("opens allowlisted links in background tabs when open_links_in_window is false", async () => {
    const settings = {
      enabled: true,
      open_links_in_window: false,
      channel_targets: [buildChannelTarget({ channel_id: "222", allowed_domains: ["walmart.com"] })],
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
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it("skips allowlisted links on negative-only keyword match", async () => {
    const storage: Record<string, unknown> = {
      "cookiescripts:settings": {
        enabled: true,
        watch_keywords: {
          walmart: { negative: ["scam"] },
        },
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["walmart.com"],
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
        urls: ["https://walmart.com/item"],
        author: "alice",
        message_text: "this is a scam link",
      },
      sender,
    );

    expect(response).toEqual({ ok: true, opened: [], duplicates: [] });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(storage["cookiescripts:history"]).toEqual([
      expect.objectContaining({
        kind: "keyword_skipped",
        url: "https://walmart.com/item",
      }),
    ]);
    expect(recentUrlKeys.size).toBe(0);
  });

  it("opens when positive keyword overrides negative match", async () => {
    const settings = {
      enabled: true,
      watch_keywords: {
        walmart: { positive: ["pokemon"], negative: ["scam"] },
      },
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["walmart.com"],
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
        urls: ["https://walmart.com/item"],
        message_text: "pokemon scam deal",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: ["https://walmart.com/item"],
    });
    expect(chrome.windows.create).toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("opens when neither keyword matches", async () => {
    const settings = {
      enabled: true,
      watch_keywords: {
        walmart: { negative: ["scam"] },
      },
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["walmart.com"],
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
        urls: ["https://walmart.com/item"],
        message_text: "random deal",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: ["https://walmart.com/item"],
    });
    expect(chrome.windows.create).toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
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

  it("notifies status revision on CHANNEL_ACTIVE", async () => {
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

    await handleMessage({ type: "CHANNEL_ACTIVE", channel_id: "222" }, sender);

    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.statusRevision]: expect.any(Number) }),
    );
  });

  it("notifies status revision on CHANNEL_INACTIVE", async () => {
    activeChannels.set(1, "222");

    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    await handleMessage({ type: "CHANNEL_INACTIVE" }, sender);

    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.statusRevision]: expect.any(Number) }),
    );
    expect(activeChannels.has(1)).toBe(false);
  });

  it("does not notify status revision for invalid CHANNEL_ACTIVE", async () => {
    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    await handleMessage(
      { type: "CHANNEL_ACTIVE", channel_id: "9999999999999999999" },
      sender,
    );

    expect(chrome.storage.session.set).not.toHaveBeenCalled();
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

  it("opens walmart links once when retailer_link_open_count is 3", async () => {
    const settings = {
      enabled: true,
      retailer_link_open_count: 3,
      channel_targets: [buildChannelTarget({ channel_id: "222", allowed_domains: ["walmart.com"] })],
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
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
  });

  it("opens target links once per unique url when the same url appears twice in one message", async () => {
    const storage: Record<string, unknown> = {
      "cookiescripts:settings": {
        enabled: true,
        retailer_auto_atc_enabled: true,
        retailer_link_open_count: 3,
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["target.com"],
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

    const productUrl = "https://www.target.com/p/foo/-/A-123";
    const response = await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: [productUrl, productUrl],
        author: "alice",
      },
      sender,
    );

    expect(response).toMatchObject({
      ok: true,
      opened: [productUrl, productUrl, productUrl],
      duplicates: [],
    });
    expect(chrome.windows.create).toHaveBeenCalledTimes(3);
    expect(storage["cookiescripts:history"]).toHaveLength(3);
    expect(storage["cookiescripts:history"]).toEqual([
      expect.objectContaining({ kind: "retailer_window_opened", url: productUrl }),
      expect.objectContaining({ kind: "retailer_window_opened", url: productUrl }),
      expect.objectContaining({ kind: "retailer_window_opened", url: productUrl }),
    ]);
  });

  it("prepends open history once per candidate links batch", async () => {
    const storageModule = await import("@ext/core/lib/storage.ts");
    const prependSpy = vi.spyOn(storageModule, "prependHistory");
    const settings = {
      enabled: true,
      retailer_link_open_count: 2,
      channel_targets: [buildChannelTarget({ channel_id: "222", allowed_domains: ["walmart.com"] })],
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

    await handleMessage(
      {
        type: "CANDIDATE_LINKS",
        channel_id: "222",
        urls: ["https://walmart.com/item"],
        author: "alice",
      },
      sender,
    );

    expect(prependSpy).toHaveBeenCalledTimes(1);
    prependSpy.mockRestore();
  });

  describe("SKU open mode", () => {
    function mockSkuSettings(settings: Record<string, unknown>, storage: Record<string, unknown>) {
      vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of keyList) {
          if (key === "cookiescripts:settings") {
            result[key] = settings;
          } else if (key === "cookiescripts:history") {
            result[key] = storage["cookiescripts:history"] ?? [];
          } else if (key === "cookiescripts:recentUrls") {
            result[key] = storage["cookiescripts:recentUrls"] ?? [];
          }
        }
        return result;
      });
      (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
        async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        },
      );
    }

    it("opens constructed PDP when href-only SKU matches and bypasses keyword gate", async () => {
      const storage: Record<string, unknown> = {
        "cookiescripts:history": [],
        "cookiescripts:recentUrls": [],
      };
      const settings = {
        enabled: true,
        sku_open_mode_enabled: true,
        watch_skus: { target: ["95120834"] },
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["target.com"],
          }),
        ],
      };
      mockSkuSettings(settings, storage);

      const sender = mockContentSender({
        extensionId: EXTENSION_ID,
        tabUrl: "https://discord.com/channels/111/222",
      });

      const response = await handleMessage(
        {
          type: "CANDIDATE_LINKS",
          channel_id: "222",
          urls: ["https://howl.link/abc", "https://www.target.com/s?searchTerm=95120834"],
          anchors: [
            { href: "https://howl.link/abc", text: "Pokemon TCG" },
            { href: "https://www.target.com/s?searchTerm=95120834", text: "ATC" },
          ],
          message_text: "Target restock block",
          author: "alice",
        },
        sender,
      );

      expect(response).toMatchObject({
        ok: true,
        opened: ["https://www.target.com/p/-/A-95120834"],
      });
      expect(chrome.windows.create).toHaveBeenCalledWith({
        url: "https://www.target.com/p/-/A-95120834",
        focused: true,
      });
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it("opens constructed PDP when SKU matches but only auxiliary links exist", async () => {
      const storage: Record<string, unknown> = {
        "cookiescripts:history": [],
        "cookiescripts:recentUrls": [],
      };
      const settings = {
        enabled: true,
        sku_open_mode_enabled: true,
        watch_skus: { target: ["94860231"] },
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["target.com"],
          }),
        ],
      };
      mockSkuSettings(settings, storage);

      const sender = mockContentSender({
        extensionId: EXTENSION_ID,
        tabUrl: "https://discord.com/channels/111/222",
      });

      const response = await handleMessage(
        {
          type: "CANDIDATE_LINKS",
          channel_id: "222",
          urls: ["https://www.target.com/s?searchTerm=94860231"],
          anchors: [
            { href: "https://www.target.com/s?searchTerm=94860231", text: "ATC" },
          ],
          message_text: "Target restock",
          author: "alice",
        },
        sender,
      );

      expect(response).toMatchObject({
        ok: true,
        opened: ["https://www.target.com/p/-/A-94860231"],
      });
    });

    it("records sku_skipped when no configured SKU matches", async () => {
      const storage: Record<string, unknown> = {
        "cookiescripts:history": [],
        "cookiescripts:recentUrls": [],
      };
      const settings = {
        enabled: true,
        sku_open_mode_enabled: true,
        watch_skus: { target: ["11111111"] },
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["target.com"],
          }),
        ],
      };
      mockSkuSettings(settings, storage);

      const sender = mockContentSender({
        extensionId: EXTENSION_ID,
        tabUrl: "https://discord.com/channels/111/222",
      });

      const response = await handleMessage(
        {
          type: "CANDIDATE_LINKS",
          channel_id: "222",
          urls: ["https://howl.link/abc"],
          message_text: "Target restock",
          author: "alice",
        },
        sender,
      );

      expect(response).toEqual({ ok: true, opened: [], duplicates: [] });
      expect(chrome.windows.create).not.toHaveBeenCalled();
      expect(storage["cookiescripts:history"]).toEqual([
        expect.objectContaining({
          kind: "sku_skipped",
          url: "https://howl.link/abc",
        }),
      ]);
    });

    it("no-ops Target SKU path when channel has no configured SKUs", async () => {
      const settings = {
        enabled: true,
        sku_open_mode_enabled: true,
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["target.com"],
          }),
        ],
      };
      mockSkuSettings(settings, {});

      const sender = mockContentSender({
        extensionId: EXTENSION_ID,
        tabUrl: "https://discord.com/channels/111/222",
      });

      const response = await handleMessage(
        {
          type: "CANDIDATE_LINKS",
          channel_id: "222",
          urls: ["https://howl.link/abc"],
          message_text: "SKU 95120834",
        },
        sender,
      );

      expect(response).toEqual({ ok: true, opened: [], duplicates: [] });
      expect(chrome.windows.create).not.toHaveBeenCalled();
    });

    it("opens Walmart links in SKU mode when Walmart keywords pass", async () => {
      const storage: Record<string, unknown> = {
        "cookiescripts:history": [],
        "cookiescripts:recentUrls": [],
      };
      const settings = {
        enabled: true,
        sku_open_mode_enabled: true,
        watch_keywords: {
          walmart: { positive: ["pokemon"], negative: [] },
        },
        watch_skus: { target: ["95120834"] },
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["walmart.com", "target.com"],
          }),
        ],
      };
      mockSkuSettings(settings, storage);

      const sender = mockContentSender({
        extensionId: EXTENSION_ID,
        tabUrl: "https://discord.com/channels/111/222",
      });

      const response = await handleMessage(
        {
          type: "CANDIDATE_LINKS",
          channel_id: "222",
          urls: ["https://www.walmart.com/ip/pokemon"],
          message_text: "pokemon drop",
          author: "alice",
        },
        sender,
      );

      expect(response).toMatchObject({
        ok: true,
        opened: ["https://www.walmart.com/ip/pokemon"],
      });
      expect(chrome.windows.create).toHaveBeenCalledWith({
        url: "https://www.walmart.com/ip/pokemon",
        focused: false,
      });
    });

    it("blocks other allowlisted domains in SKU mode", async () => {
      const settings = {
        enabled: true,
        sku_open_mode_enabled: true,
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["amazon.com"],
          }),
        ],
      };
      mockSkuSettings(settings, {});

      const sender = mockContentSender({
        extensionId: EXTENSION_ID,
        tabUrl: "https://discord.com/channels/111/222",
      });

      const response = await handleMessage(
        {
          type: "CANDIDATE_LINKS",
          channel_id: "222",
          urls: ["https://amazon.com/dp/123"],
          message_text: "deal",
        },
        sender,
      );

      expect(response).toEqual({ ok: true, opened: [], duplicates: [] });
      expect(chrome.windows.create).not.toHaveBeenCalled();
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it("uses Walmart keywords not Target keywords for Walmart links in normal mode", async () => {
      const storage: Record<string, unknown> = {
        "cookiescripts:history": [],
        "cookiescripts:recentUrls": [],
      };
      const settings = {
        enabled: true,
        watch_keywords: {
          target: { positive: [], negative: ["pokemon"] },
          walmart: { positive: [], negative: [] },
        },
        channel_targets: [
          buildChannelTarget({
            channel_id: "222",
            allowed_domains: ["walmart.com"],
          }),
        ],
      };
      mockSkuSettings(settings, storage);

      const sender = mockContentSender({
        extensionId: EXTENSION_ID,
        tabUrl: "https://discord.com/channels/111/222",
      });

      const response = await handleMessage(
        {
          type: "CANDIDATE_LINKS",
          channel_id: "222",
          urls: ["https://walmart.com/item"],
          message_text: "pokemon drop",
        },
        sender,
      );

      expect(response).toMatchObject({
        ok: true,
        opened: ["https://walmart.com/item"],
      });
      expect(chrome.windows.create).toHaveBeenCalled();
    });
  });
});
