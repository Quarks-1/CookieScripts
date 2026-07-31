import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleSetWalmartAutoRefreshEnabled,
  handleSetWalmartRefreshInterval,
  handleWalmartAutoRefreshContentMessage,
  reconcileWalmartAutoRefreshInterval,
  resolveWalmartAutoRefreshForTab,
} from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import { saveSettings } from "@ext/core/lib/storage.ts";
import {
  clearWalmartRuntimeState,
  getWalmartTabAutoRefresh,
  setWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";

vi.mock("@ext/core/lib/storage.ts", () => ({
  getSettings: vi.fn().mockResolvedValue({ enabled: true, channel_targets: [] }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
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

  it("resolveWalmartAutoRefreshForTab returns effective enabled when only schedule_enabled is true", () => {
    setWalmartTabAutoRefresh(8, { enabled: false, schedule_enabled: true, interval_sec: 12 });

    const config = resolveWalmartAutoRefreshForTab(8, true, {
      enabled: true,
      channel_targets: [],
    });

    expect(config).toEqual({
      enabled: true,
      interval_sec: 12,
      pause: false,
      last_refresh_at: undefined,
    });
  });

  it("GET returns effective enabled true when only schedule_enabled is true", async () => {
    setWalmartTabAutoRefresh(2, { enabled: false, schedule_enabled: true, interval_sec: 10 });

    const result = await handleWalmartAutoRefreshContentMessage(
      { type: "WALMART_GET_AUTO_REFRESH_CONFIG" },
      { tab: { id: 2 } } as chrome.runtime.MessageSender,
    );

    expect(result).toEqual({ ok: true, enabled: true, interval_sec: 10, pause: false });
  });

  it("persists global refresh interval when changed from the panel", async () => {
    const result = await handleSetWalmartRefreshInterval({
      type: "SET_WALMART_REFRESH_INTERVAL",
      interval_sec: 25,
    });

    expect(result).toEqual({ ok: true });
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ walmart_refresh_interval_sec: 25 }),
    );
    expect(getWalmartTabAutoRefresh(7)?.interval_sec).toBe(25);
  });

  it("reconciles active tab intervals after a full settings replacement", async () => {
    setWalmartTabAutoRefresh(7, {
      enabled: true,
      schedule_enabled: false,
      interval_sec: 10,
      last_refresh_at: 1,
    });
    vi.spyOn(Date, "now").mockReturnValue(1234);

    await reconcileWalmartAutoRefreshInterval({
      enabled: true,
      channel_targets: [],
      walmart_refresh_interval_sec: 25,
    });

    expect(getWalmartTabAutoRefresh(7)).toEqual({
      enabled: true,
      schedule_enabled: false,
      interval_sec: 25,
      last_refresh_at: 1234,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: "WALMART_AUTO_REFRESH_CONFIG",
      enabled: true,
      interval_sec: 25,
      pause: false,
      last_refresh_at: 1234,
    });
  });
});
