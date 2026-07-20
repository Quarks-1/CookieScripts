import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStatus } from "@ext/core/background/status.ts";
import { activeChannels } from "@ext/core/background/runtime-state.ts";
import {
  clearRetailerRuntimeState,
  setRetailerTabPurchaseLimit,
} from "@ext/domains/target/background/runtime-state.ts";

vi.mock("@ext/core/lib/storage.ts", () => ({
  getSettings: vi.fn().mockResolvedValue({ enabled: true, channel_targets: [] }),
}));

vi.mock("@ext/domains/walmart/background/runtime-state.ts", () => ({
  readMetrics: vi.fn().mockResolvedValue({
    sessionId: null,
    eventCount: 0,
    bytes: 0,
    dropDate: null,
    recordingActive: false,
    startedAt: null,
  }),
  readLastExport: vi.fn().mockResolvedValue(null),
  isAnyWalmartRecording: vi.fn().mockReturnValue(false),
  isWalmartTabRecording: vi.fn().mockReturnValue(false),
  recordingTabCount: vi.fn().mockReturnValue(0),
  getWalmartTabAutoRefresh: vi.fn().mockReturnValue(undefined),
}));

vi.mock("@ext/domains/walmart/background/tabs.ts", () => ({
  listAllWalmartTabs: vi.fn().mockResolvedValue([]),
}));

vi.mock("@ext/domains/samsclub/background/runtime-state.ts", () => ({
  readMetrics: vi.fn().mockResolvedValue({
    sessionId: null,
    eventCount: 0,
    bytes: 0,
    dropDate: null,
    recordingActive: false,
    startedAt: null,
  }),
  readLastExport: vi.fn().mockResolvedValue(null),
  isAnySamsclubRecording: vi.fn().mockReturnValue(false),
  isSamsclubTabRecording: vi.fn().mockReturnValue(false),
  recordingTabCount: vi.fn().mockReturnValue(0),
}));

vi.mock("@ext/domains/samsclub/background/tabs.ts", () => ({
  listAllSamsclubTabs: vi.fn().mockResolvedValue([]),
}));

vi.mock("@ext/domains/target/background/tabs.ts", () => ({
  listAllRetailerTabs: vi.fn().mockResolvedValue([]),
}));

describe("buildStatus", () => {
  beforeEach(() => {
    clearRetailerRuntimeState();
    vi.stubGlobal("chrome", {
      tabs: {
        sendMessage: vi.fn(),
      },
    });
  });

  it("prefers cached purchase limit over tab pull on Target tabs", async () => {
    const sendMessage = vi.mocked(chrome.tabs.sendMessage);
    setRetailerTabPurchaseLimit(
      5,
      "https://www.target.com/p/foo/-/A-123",
      2,
    );

    const status = await buildStatus({
      id: 5,
      url: "https://www.target.com/p/foo/-/A-123",
    } as chrome.tabs.Tab);

    expect(status.retailer_purchase_limit).toBe(2);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("re-queries purchase limit when cache is null", async () => {
    const sendMessage = vi.mocked(chrome.tabs.sendMessage);
    sendMessage.mockResolvedValue({ ok: true, purchase_limit: 20 });
    setRetailerTabPurchaseLimit(
      5,
      "https://www.target.com/p/foo/-/A-123",
      null,
    );

    const status = await buildStatus({
      id: 5,
      url: "https://www.target.com/p/foo/-/A-123",
    } as chrome.tabs.Tab);

    expect(status.retailer_purchase_limit).toBe(20);
    expect(sendMessage).toHaveBeenCalledWith(5, { type: "RETAILER_GET_PURCHASE_LIMIT" });
  });

  it("sets retailer_tab_detected when active tab is on target.com", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://www.target.com/p/foo/-/A-123",
    } as chrome.tabs.Tab);
    expect(status.retailer_tab_detected).toBe(true);
    expect(status.active_tab_kind).toBe("retailer");
  });

  it("clears retailer_tab_detected for non-Target tabs", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.retailer_tab_detected).toBe(false);
    expect(status.active_tab_kind).toBe("discord_channel");
  });

  it("sets active_tab_kind to other for unrelated tabs", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://www.google.com/",
    } as chrome.tabs.Tab);
    expect(status.active_tab_kind).toBe("other");
    expect(status.retailer_tab_detected).toBe(false);
  });

  it("sets walmart_tab_detected when active tab is on walmart.com", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://www.walmart.com/ip/item",
    } as chrome.tabs.Tab);
    expect(status.walmart_tab_detected).toBe(true);
    expect(status.active_tab_kind).toBe("walmart");
  });

  it("sets walmart_recording_active on Discord when recording", async () => {
    const { readMetrics } = await import("@ext/domains/walmart/background/runtime-state.ts");
    vi.mocked(readMetrics).mockResolvedValueOnce({
      sessionId: "session-1",
      eventCount: 1,
      bytes: 100,
      dropDate: "2026-01-01",
      recordingActive: true,
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    activeChannels.clear();
    const result = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(result.walmart_recording_active).toBe(true);
    expect(result.active_tab_kind).toBe("discord_channel");
  });

  it("marks isActive using the focused window active tab id", async () => {
    const { listAllWalmartTabs } = await import("@ext/domains/walmart/background/tabs.ts");
    vi.mocked(listAllWalmartTabs).mockResolvedValueOnce([
      {
        id: 1,
        windowId: 10,
        url: "https://www.walmart.com/ip/pokemon-tcg/123",
        title: "Pokémon TCG - Walmart.com",
      },
      {
        id: 2,
        windowId: 10,
        url: "https://www.walmart.com/ip/pokemon-tcg/123",
        title: "Pokémon TCG - Walmart.com",
      },
      {
        id: 3,
        windowId: 10,
        url: "https://www.walmart.com/ip/pokemon-tcg/123",
        title: "Pokémon TCG - Walmart.com",
      },
    ] as chrome.tabs.Tab[]);

    activeChannels.clear();
    const result = await buildStatus({
      id: 3,
      windowId: 10,
      url: "https://www.walmart.com/ip/pokemon-tcg/123",
    } as chrome.tabs.Tab);

    expect(result.walmart_open_tabs.map((tab) => tab.isActive)).toEqual([false, false, true]);
  });

  it("populates walmart_open_tabs with stable sort and disambiguated labels", async () => {
    const { listAllWalmartTabs } = await import("@ext/domains/walmart/background/tabs.ts");
    const { isWalmartTabRecording } = await import("@ext/domains/walmart/background/runtime-state.ts");
    vi.mocked(listAllWalmartTabs).mockResolvedValueOnce([
      {
        id: 2,
        windowId: 10,
        url: "https://www.walmart.com/cart",
        title: "Cart - Walmart.com",
      },
      {
        id: 1,
        windowId: 10,
        url: "https://www.walmart.com/",
        title: "Walmart.com",
      },
    ] as chrome.tabs.Tab[]);
    vi.mocked(isWalmartTabRecording).mockImplementation((tabId) => tabId === 2);

    activeChannels.clear();
    const result = await buildStatus({
      id: 2,
      url: "https://www.walmart.com/cart",
    } as chrome.tabs.Tab);

    expect(result.walmart_open_tabs).toHaveLength(2);
    expect(result.walmart_open_tabs[0]?.tabId).toBe(1);
    expect(result.walmart_open_tabs[0]?.isActive).toBe(false);
    expect(result.walmart_open_tabs[0]?.label).toBe("Home");
    expect(result.walmart_open_tabs[1]?.tabId).toBe(2);
    expect(result.walmart_open_tabs[1]?.isActive).toBe(true);
    expect(result.walmart_open_tabs[1]?.label).toBe("Cart");
    expect(result.walmart_open_tabs[1]?.isRecording).toBe(true);
  });

  it("populates retailer_open_tabs with stable sort, labels, and running state", async () => {
    const { listAllRetailerTabs } = await import("@ext/domains/target/background/tabs.ts");
    const { setRetailerTabUiState } = await import("@ext/domains/target/background/runtime-state.ts");
    vi.mocked(listAllRetailerTabs).mockResolvedValueOnce([
      {
        id: 2,
        windowId: 10,
        url: "https://www.target.com/cart",
        title: "Cart : Target",
      },
      {
        id: 1,
        windowId: 10,
        url: "https://www.target.com/",
        title: "Target",
      },
    ] as chrome.tabs.Tab[]);
    setRetailerTabUiState(2, { status: "Running auto mode…", running: true });

    activeChannels.clear();
    const result = await buildStatus({
      id: 2,
      url: "https://www.target.com/cart",
    } as chrome.tabs.Tab);

    expect(result.any_retailer_tab_open).toBe(true);
    expect(result.retailer_open_tabs).toHaveLength(2);
    expect(result.retailer_open_tabs[0]?.tabId).toBe(1);
    expect(result.retailer_open_tabs[0]?.isActive).toBe(false);
    expect(result.retailer_open_tabs[0]?.label).toBe("Home");
    expect(result.retailer_open_tabs[1]?.tabId).toBe(2);
    expect(result.retailer_open_tabs[1]?.isActive).toBe(true);
    expect(result.retailer_open_tabs[1]?.label).toBe("Cart");
    expect(result.retailer_open_tabs[1]?.isRunning).toBe(true);
  });

  it("defaults open_links_in_window to true when setting is omitted", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.open_links_in_window).toBe(true);
  });

  it("reflects open_links_in_window false from settings", async () => {
    const { getSettings } = await import("@ext/core/lib/storage.ts");
    vi.mocked(getSettings).mockResolvedValueOnce({
      enabled: true,
      open_links_in_window: false,
      channel_targets: [],
    });
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.open_links_in_window).toBe(false);
  });

  it("defaults sku_open_mode_enabled to false when setting is omitted", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.sku_open_mode_enabled).toBe(false);
  });

  it("reflects sku_open_mode_enabled true from settings", async () => {
    const { getSettings } = await import("@ext/core/lib/storage.ts");
    vi.mocked(getSettings).mockResolvedValueOnce({
      enabled: true,
      sku_open_mode_enabled: true,
      channel_targets: [],
    });
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.sku_open_mode_enabled).toBe(true);
  });

  it("defaults walmart_recording_ui_enabled to false when setting is omitted", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.walmart_recording_ui_enabled).toBe(false);
  });

  it("reflects walmart_recording_ui_enabled true from settings", async () => {
    const { getSettings } = await import("@ext/core/lib/storage.ts");
    vi.mocked(getSettings).mockResolvedValueOnce({
      enabled: true,
      walmart_recording_ui_enabled: true,
      channel_targets: [],
    });
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.walmart_recording_ui_enabled).toBe(true);
  });

  it("defaults retailer_link_open_count to 1 when setting is omitted", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.retailer_link_open_count).toBe(1);
  });

  it("reflects retailer_link_open_count from settings", async () => {
    const { getSettings } = await import("@ext/core/lib/storage.ts");
    vi.mocked(getSettings).mockResolvedValueOnce({
      enabled: true,
      retailer_link_open_count: 3,
      channel_targets: [],
    });
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.retailer_link_open_count).toBe(3);
  });
});
