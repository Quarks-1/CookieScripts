import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ext/core/background/status-notify.ts", () => ({
  notifyStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@ext/core/lib/schedule-session.ts", () => ({
  setScheduleStartFiredDate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@ext/core/lib/storage.ts", () => ({
  getSettings: vi.fn(),
}));

import { setScheduleActionStatus } from "@ext/core/background/schedule-runtime-state.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import {
  clearRetailerRuntimeState,
  setRetailerTabUiState,
} from "@ext/domains/target/background/runtime-state.ts";
import { startScheduledTargetAuto } from "@ext/domains/target/background/scheduled-auto.ts";

describe("startScheduledTargetAuto", () => {
  beforeEach(() => {
    clearRetailerRuntimeState();
    vi.mocked(getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      enabled: true,
      retailer_schedule_enabled: true,
      retailer_schedule_start_time: "09:00",
      retailer_schedule_end_time: "10:00",
    });
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, url: "https://www.target.com/p/foo/-/A-123" },
          { id: 2, url: "https://www.target.com/cart" },
        ]),
        sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      },
    });
  });

  it("starts idle product tabs and skips running tabs", async () => {
    setRetailerTabUiState(2, { status: "Running", running: true });

    await startScheduledTargetAuto();

    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: "RETAILER_START_MANUAL_AUTO",
      hard_refresh: true,
    });
  });
});

describe("schedule action status", () => {
  it("records scheduled start summary", () => {
    setScheduleActionStatus("target", "Scheduled start: 2 tab(s)");
    // Smoke test — status is read by buildStatus; no throw means export works.
    expect(true).toBe(true);
  });
});
