import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleUiMessage } from "@ext/core/background/ui-handlers.ts";
import { activeChannels } from "@ext/core/background/runtime-state.ts";

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

describe("handleUiMessage GET_STATUS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeChannels.clear();

    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn(async (query: { active?: boolean; windowId?: number }) => {
          if (query.windowId === 1) {
            return [{ id: 10, url: "https://discord.com/channels/111/222" }];
          }
          if (query.windowId === 2) {
            return [{ id: 20, url: "https://www.target.com/p/foo/-/A-123" }];
          }
          return [];
        }),
      },
      windows: {
        getLastFocused: vi.fn(async () => ({ id: 2 })),
      },
    });
  });

  it("uses the side panel window id instead of the globally focused window", async () => {
    const response = await handleUiMessage({ type: "GET_STATUS", window_id: 1 }, {});

    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, windowId: 1 });
    expect(chrome.windows.getLastFocused).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      status: {
        active_tab_kind: "discord_channel",
        retailer_tab_detected: false,
      },
    });
  });

  it("falls back to the last focused window when window_id is omitted", async () => {
    const response = await handleUiMessage({ type: "GET_STATUS" }, {});

    expect(chrome.windows.getLastFocused).toHaveBeenCalled();
    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, windowId: 2 });
    expect(response).toMatchObject({
      ok: true,
      status: {
        active_tab_kind: "retailer",
        retailer_tab_detected: true,
      },
    });
  });
});
