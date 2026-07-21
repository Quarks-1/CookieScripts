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

import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import {
  clearSamsclubRuntimeState,
  setSamsclubTabUiState,
} from "@ext/domains/samsclub/background/automation-runtime-state.ts";
import { startScheduledSamsclubAuto } from "@ext/domains/samsclub/background/scheduled-auto.ts";

describe("startScheduledSamsclubAuto", () => {
  beforeEach(() => {
    clearSamsclubRuntimeState();
    vi.mocked(getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      enabled: true,
      samsclub_schedule_enabled: true,
      samsclub_schedule_start_time: "09:00",
      samsclub_schedule_end_time: "10:00",
    });
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 3, url: "https://www.samsclub.com/ip/foo/123" },
        ]),
        sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      },
    });
  });

  it("starts idle Sam's Club product tabs", async () => {
    setSamsclubTabUiState(3, { status: "Ready", running: false });

    await startScheduledSamsclubAuto();

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
      type: "SAMSCLUB_START_MANUAL_AUTO",
      hard_refresh: true,
    });
  });
});
