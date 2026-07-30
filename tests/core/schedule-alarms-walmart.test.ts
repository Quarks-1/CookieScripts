import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ext/core/background/status-notify.ts", () => ({
  notifyStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@ext/core/lib/schedule-session.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ext/core/lib/schedule-session.ts")>();
  return {
    ...actual,
    readScheduleSession: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("@ext/domains/walmart/background/scheduled-refresh.ts", () => ({
  startScheduledWalmartRefresh: vi.fn().mockResolvedValue(undefined),
  stopScheduledWalmartRefresh: vi.fn().mockResolvedValue(undefined),
  resumeScheduledWalmartRefresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@ext/domains/target/background/scheduled-auto.ts", () => ({
  startScheduledTargetAuto: vi.fn().mockResolvedValue(undefined),
  stopScheduledTargetAuto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@ext/domains/samsclub/background/scheduled-auto.ts", () => ({
  startScheduledSamsclubAuto: vi.fn().mockResolvedValue(undefined),
  stopScheduledSamsclubAuto: vi.fn().mockResolvedValue(undefined),
}));

import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { alarmName } from "@ext/core/lib/schedule.ts";
import { syncScheduleAlarms } from "@ext/core/background/schedule-alarms.ts";
import { startScheduledWalmartRefresh } from "@ext/domains/walmart/background/scheduled-refresh.ts";

function localDate(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds = 0,
): Date {
  return new Date(year, month - 1, day, hours, minutes, seconds, 0);
}

describe("syncScheduleAlarms walmart unbounded schedule", () => {
  const createdAlarms: Array<{ name: string; when: number }> = [];

  beforeEach(() => {
    createdAlarms.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(localDate(2026, 7, 21, 22, 0));

    vi.stubGlobal("chrome", {
      alarms: {
        clear: vi.fn().mockResolvedValue(true),
        create: vi.fn().mockImplementation((name: string, info: { when: number }) => {
          createdAlarms.push({ name, when: info.when });
          return Promise.resolve();
        }),
        getAll: vi.fn().mockResolvedValue([]),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not immediate-start when enabling unbounded schedule after today's start", async () => {
    await syncScheduleAlarms({
      ...DEFAULT_SETTINGS,
      enabled: true,
      walmart_schedule_enabled: true,
      walmart_schedule_start_time: "09:00:00",
    });

    expect(startScheduledWalmartRefresh).not.toHaveBeenCalled();
    expect(createdAlarms).toEqual(
      expect.arrayContaining([
        {
          name: alarmName("walmart", "start"),
          when: localDate(2026, 7, 22, 9, 0).getTime(),
        },
      ]),
    );
  });
});
