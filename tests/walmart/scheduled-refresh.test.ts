import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ext/core/background/status-notify.ts", () => ({
  notifyStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@ext/core/lib/schedule-session.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ext/core/lib/schedule-session.ts")>();
  return {
    ...actual,
    readScheduleSession: vi.fn(),
    setScheduleStartFiredDate: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@ext/core/lib/storage.ts", () => ({
  getSettings: vi.fn(),
}));

import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { readScheduleSession } from "@ext/core/lib/schedule-session.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import {
  clearWalmartRuntimeState,
  getWalmartTabAutoRefresh,
  hasWalmartTabAutoRefresh,
  setWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";
import {
  resumeScheduledWalmartRefresh,
  seedScheduledWalmartRefreshForTab,
  startScheduledWalmartRefresh,
  stopScheduledWalmartRefresh,
} from "@ext/domains/walmart/background/scheduled-refresh.ts";

function scheduleSettings(overrides: Record<string, unknown> = {}) {
  return {
    ...DEFAULT_SETTINGS,
    enabled: true,
    walmart_schedule_enabled: true,
    walmart_schedule_start_time: "09:00:00",
    walmart_refresh_interval_sec: 15,
    ...overrides,
  };
}

describe("startScheduledWalmartRefresh", () => {
  beforeEach(() => {
    clearWalmartRuntimeState();
    vi.mocked(getSettings).mockResolvedValue(scheduleSettings());
    vi.mocked(readScheduleSession).mockResolvedValue({});
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, url: "https://www.walmart.com/ip/foo" },
          { id: 2, url: "https://www.walmart.com/cart" },
        ]),
        reload: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  });

  it("sets schedule_enabled and reloads every open Walmart tab without flipping manual enabled", async () => {
    setWalmartTabAutoRefresh(1, { enabled: false, interval_sec: 5 });

    await startScheduledWalmartRefresh();

    expect(getWalmartTabAutoRefresh(1)).toEqual({
      enabled: false,
      schedule_enabled: true,
      interval_sec: 5,
      last_refresh_at: 1_700_000_000_000,
    });
    expect(getWalmartTabAutoRefresh(2)).toEqual({
      enabled: false,
      schedule_enabled: true,
      interval_sec: 15,
      last_refresh_at: 1_700_000_000_000,
    });
    expect(chrome.tabs.reload).toHaveBeenCalledWith(1, { bypassCache: true });
    expect(chrome.tabs.reload).toHaveBeenCalledWith(2, { bypassCache: true });
  });
});

describe("stopScheduledWalmartRefresh", () => {
  beforeEach(() => {
    clearWalmartRuntimeState();
    vi.mocked(getSettings).mockResolvedValue(scheduleSettings());
    vi.stubGlobal("chrome", {
      tabs: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("clears schedule_enabled while preserving manual enabled and interval", async () => {
    setWalmartTabAutoRefresh(4, {
      enabled: true,
      schedule_enabled: true,
      interval_sec: 7,
      last_refresh_at: 100,
    });

    await stopScheduledWalmartRefresh();

    expect(getWalmartTabAutoRefresh(4)).toEqual({
      enabled: true,
      schedule_enabled: false,
      interval_sec: 7,
      last_refresh_at: 100,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(4, {
      type: "WALMART_AUTO_REFRESH_CONFIG",
      enabled: true,
      interval_sec: 7,
      pause: false,
      last_refresh_at: 100,
    });
  });

  it("removes map entry when both manual and schedule flags are off", async () => {
    setWalmartTabAutoRefresh(5, {
      enabled: false,
      schedule_enabled: true,
      interval_sec: 10,
      last_refresh_at: 200,
    });

    await stopScheduledWalmartRefresh();

    expect(hasWalmartTabAutoRefresh(5)).toBe(false);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, {
      type: "WALMART_AUTO_REFRESH_CONFIG",
      enabled: false,
      interval_sec: 10,
      pause: false,
      last_refresh_at: 200,
    });
  });
});

describe("seedScheduledWalmartRefreshForTab", () => {
  beforeEach(() => {
    clearWalmartRuntimeState();
    vi.mocked(getSettings).mockResolvedValue(scheduleSettings());
    vi.mocked(readScheduleSession).mockResolvedValue({
      start_fired_date: new Date().toISOString().slice(0, 10),
    });
  });

  it("writes schedule_enabled for an untracked tab in an active window", async () => {
    const today = new Date();
    vi.mocked(readScheduleSession).mockResolvedValue({
      start_fired_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    });

    await seedScheduledWalmartRefreshForTab(9);

    expect(getWalmartTabAutoRefresh(9)?.enabled).toBe(false);
    expect(getWalmartTabAutoRefresh(9)?.schedule_enabled).toBe(true);
    expect(getWalmartTabAutoRefresh(9)?.interval_sec).toBe(15);
  });

  it("sets schedule_enabled on a manually disabled tab without flipping manual enabled", async () => {
    const today = new Date();
    vi.mocked(readScheduleSession).mockResolvedValue({
      start_fired_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    });
    setWalmartTabAutoRefresh(9, { enabled: false, interval_sec: 5 });

    await seedScheduledWalmartRefreshForTab(9);

    expect(getWalmartTabAutoRefresh(9)).toEqual({
      enabled: false,
      schedule_enabled: true,
      interval_sec: 5,
      last_refresh_at: expect.any(Number),
    });
  });
});

describe("resumeScheduledWalmartRefresh", () => {
  beforeEach(() => {
    clearWalmartRuntimeState();
    vi.mocked(getSettings).mockResolvedValue(scheduleSettings());
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 10, url: "https://www.walmart.com/" },
          { id: 11, url: "https://www.walmart.com/ip/bar" },
        ]),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("seeds schedule_enabled on tabs not yet under schedule and pushes effective enabled", async () => {
    const today = new Date();
    vi.mocked(readScheduleSession).mockResolvedValue({
      start_fired_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    });
    setWalmartTabAutoRefresh(10, { enabled: false, interval_sec: 5 });

    await resumeScheduledWalmartRefresh();

    expect(getWalmartTabAutoRefresh(10)).toEqual({
      enabled: false,
      schedule_enabled: true,
      interval_sec: 5,
      last_refresh_at: expect.any(Number),
    });
    expect(getWalmartTabAutoRefresh(11)?.enabled).toBe(false);
    expect(getWalmartTabAutoRefresh(11)?.schedule_enabled).toBe(true);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(10, {
      type: "WALMART_AUTO_REFRESH_CONFIG",
      enabled: true,
      interval_sec: 5,
      pause: false,
      last_refresh_at: expect.any(Number),
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(11, {
      type: "WALMART_AUTO_REFRESH_CONFIG",
      enabled: true,
      interval_sec: 15,
      pause: false,
      last_refresh_at: expect.any(Number),
    });
  });
});
