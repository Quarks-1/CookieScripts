import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleMessage } from "@ext/core/background/handlers.ts";
import {
  activeChannels,
  initRuntimeState,
  recentUrlKeys,
} from "@ext/core/background/runtime-state.ts";
import { EXTENSION_ID, setupChromeMocks } from "../fixtures/handlers-setup.ts";
import { mockContentSender } from "../fixtures/fixtures.ts";

vi.mock("@ext/core/lib/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ext/core/lib/storage.ts")>();
  return {
    ...actual,
    getSettings: vi.fn().mockResolvedValue({
      enabled: true,
      channel_targets: [],
      walmart_consolidate_queue_tabs_enabled: true,
    }),
  };
});

vi.mock("@ext/domains/walmart/background/runtime-state.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ext/domains/walmart/background/runtime-state.ts")>();
  return {
    ...actual,
    isWalmartTabRecording: vi.fn().mockReturnValue(false),
  };
});

vi.mock("@ext/domains/walmart/background/tabs.ts", () => ({
  listAllWalmartTabs: vi.fn().mockResolvedValue([]),
}));

function mockWalmartTab(id: number, url: string): chrome.tabs.Tab {
  return { id, url } as chrome.tabs.Tab;
}

function mockWalmartSender(tabId = 5, tabUrl = "https://www.walmart.com/") {
  return mockContentSender({
    extensionId: EXTENSION_ID,
    tabId,
    tabUrl,
  });
}

describe("handleMessage — walmart", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupChromeMocks();
    recentUrlKeys.clear();
    activeChannels.clear();
    await initRuntimeState();

    const { getSettings } = await import("@ext/core/lib/storage.ts");
    vi.mocked(getSettings).mockResolvedValue({
      enabled: true,
      channel_targets: [],
      walmart_consolidate_queue_tabs_enabled: true,
    });

    const { listAllWalmartTabs } = await import("@ext/domains/walmart/background/tabs.ts");
    vi.mocked(listAllWalmartTabs).mockResolvedValue([]);

    const { isWalmartTabRecording } = await import("@ext/domains/walmart/background/runtime-state.ts");
    vi.mocked(isWalmartTabRecording).mockReturnValue(false);

    vi.stubGlobal("chrome", {
      ...chrome,
      storage: {
        ...chrome.storage,
        session: {
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({}),
        },
      },
      tabs: {
        ...chrome.tabs,
        remove: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([]),
      },
    });
  });

  it("rejects walmart content messages from non-walmart senders", async () => {
    const sender = mockContentSender({
      extensionId: EXTENSION_ID,
      tabUrl: "https://discord.com/channels/111/222",
    });

    const response = await handleMessage({ type: "WALMART_PING" }, sender);

    expect(response).toEqual({ ok: false, error: "Unauthorized sender" });
  });

  it("routes WALMART_QUEUE_PASS from walmart sender", async () => {
    const sender = mockWalmartSender(7, "https://www.walmart.com/ip/foo/123");

    const response = await handleMessage(
      { type: "WALMART_QUEUE_PASS", itemId: "123", queueId: "q1" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(chrome.storage.session.set).toHaveBeenCalled();
  });

  it("sends Past queue marker when recording tab passes queue", async () => {
    const { isWalmartTabRecording } = await import("@ext/domains/walmart/background/runtime-state.ts");
    vi.mocked(isWalmartTabRecording).mockReturnValue(true);

    const sender = mockWalmartSender(9, "https://www.walmart.com/");

    const response = await handleMessage(
      { type: "WALMART_QUEUE_PASS", itemId: "456", queueId: "q2", productName: "Widget" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(9, {
      type: "WALMART_RECORDING_MARK",
      label: "Past queue",
    });
  });

  it("closes duplicate /qp tabs on consolidate request while protecting sender", async () => {
    const { listAllWalmartTabs } = await import("@ext/domains/walmart/background/tabs.ts");
    vi.mocked(listAllWalmartTabs).mockResolvedValue([
      mockWalmartTab(2, "https://www.walmart.com/qp?qpdata=abc"),
      mockWalmartTab(5, "https://www.walmart.com/qp?qpdata=def"),
      mockWalmartTab(8, "https://www.walmart.com/qp?qpdata=ghi"),
    ]);

    const sender = mockWalmartSender(5, "https://www.walmart.com/qp?qpdata=def");

    const response = await handleMessage(
      { type: "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST", trigger: "issue_ticket" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(8);
  });

  it("skips tab consolidation when setting is disabled", async () => {
    const { getSettings } = await import("@ext/core/lib/storage.ts");
    vi.mocked(getSettings).mockResolvedValue({
      enabled: true,
      channel_targets: [],
      walmart_consolidate_queue_tabs_enabled: false,
    });

    const { listAllWalmartTabs } = await import("@ext/domains/walmart/background/tabs.ts");
    vi.mocked(listAllWalmartTabs).mockResolvedValue([
      mockWalmartTab(2, "https://www.walmart.com/qp?qpdata=abc"),
      mockWalmartTab(8, "https://www.walmart.com/qp?qpdata=ghi"),
    ]);

    const sender = mockWalmartSender(2, "https://www.walmart.com/qp?qpdata=abc");

    const response = await handleMessage(
      { type: "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST", trigger: "tickets_pending" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });
});
