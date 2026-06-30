import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleSetWalmartAutoRefreshEnabled,
  handleWalmartAutoRefreshContentMessage,
} from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import {
  clearWalmartRuntimeState,
  getWalmartTabAutoRefresh,
  setWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";

vi.mock("@ext/core/lib/storage.ts", () => ({
  getSettings: vi.fn().mockResolvedValue({ enabled: true, channel_targets: [] }),
}));

vi.mock("@ext/domains/walmart/background/tab-message.ts", () => ({
  getActiveWalmartTabInWindow: vi.fn().mockResolvedValue({ id: 7, url: "https://www.walmart.com/ip/foo" }),
}));

describe("walmart auto-refresh handlers", () => {
  beforeEach(() => {
    clearWalmartRuntimeState();
    vi.stubGlobal("chrome", {
      tabs: {
        reload: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("blocks enable when interval is below 1", async () => {
    setWalmartTabAutoRefresh(7, { enabled: false, interval_sec: 0 });
    const result = await handleSetWalmartAutoRefreshEnabled({ type: "SET_WALMART_AUTO_REFRESH_ENABLED", enabled: true });
    expect(result).toEqual({ ok: false, error: "Set interval to at least 1 second" });
  });

  it("WALMART_HARD_RELOAD sets last_refresh_at before reload", async () => {
    setWalmartTabAutoRefresh(3, { enabled: true, interval_sec: 10 });
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const result = await handleWalmartAutoRefreshContentMessage(
      { type: "WALMART_HARD_RELOAD" },
      { tab: { id: 3 } } as chrome.runtime.MessageSender,
    );

    expect(result).toEqual({ ok: true });
    expect(getWalmartTabAutoRefresh(3)?.last_refresh_at).toBe(now);
    expect(chrome.tabs.reload).toHaveBeenCalledWith(3, { bypassCache: true });
  });

  it("GET returns disabled when extension is off", async () => {
    const { getSettings } = await import("@ext/core/lib/storage.ts");
    vi.mocked(getSettings).mockResolvedValueOnce({ enabled: false, channel_targets: [] });

    const result = await handleWalmartAutoRefreshContentMessage(
      { type: "WALMART_GET_AUTO_REFRESH_CONFIG" },
      { tab: { id: 2 } } as chrome.runtime.MessageSender,
    );

    expect(result).toEqual({ ok: true, enabled: false, interval_sec: 10, pause: false });
  });
});
