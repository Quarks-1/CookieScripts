import { describe, expect, it } from "vitest";

import {
  alarmName,
  formatLocalDate,
  getSchedulePhase,
  isInWindowImmediateScheduleStart,
  msUntil,
  nextLocalMidnight,
  nextStartAlarmAt,
  parseLocalTimeOnDate,
  parseScheduleAlarmName,
  resolveNextScheduleStartAt,
  resolveScheduleWindow,
  schedulePhaseStatusLine,
} from "@ext/core/lib/schedule.ts";
import { normalizeScheduleTime } from "@ext/core/lib/schedule-settings.ts";

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

describe("parseLocalTimeOnDate", () => {
  it("parses HH:mm on the calendar day of now", () => {
    const now = localDate(2026, 7, 21, 14, 30);
    const parsed = parseLocalTimeOnDate("09:00", now);
    expect(parsed).toEqual(localDate(2026, 7, 21, 9, 0));
  });

  it("parses HH:mm:ss with seconds", () => {
    const now = localDate(2026, 7, 21, 14, 30);
    const parsed = parseLocalTimeOnDate("09:00:30", now);
    expect(parsed).toEqual(localDate(2026, 7, 21, 9, 0, 30));
  });

  it("returns null for invalid input", () => {
    expect(parseLocalTimeOnDate("25:00", localDate(2026, 7, 21, 9, 0))).toBeNull();
    expect(parseLocalTimeOnDate("abc", localDate(2026, 7, 21, 9, 0))).toBeNull();
  });
});

describe("normalizeScheduleTime", () => {
  it("pads legacy HH:mm to HH:mm:ss", () => {
    expect(normalizeScheduleTime("9:00")).toBe("09:00:00");
    expect(normalizeScheduleTime("09:00:30")).toBe("09:00:30");
  });
});

describe("resolveScheduleWindow", () => {
  it("resolves same-day window without end", () => {
    const now = localDate(2026, 7, 21, 8, 0);
    const window = resolveScheduleWindow("09:00", undefined, now);
    expect(window).toEqual({
      startAt: localDate(2026, 7, 21, 9, 0),
      endAt: null,
      spansMidnight: false,
      windowStartDate: "2026-07-21",
    });
  });

  it("resolves overnight window in post-midnight tail", () => {
    const now = localDate(2026, 7, 22, 0, 10);
    const window = resolveScheduleWindow("23:50", "00:30", now);
    expect(window?.startAt).toEqual(localDate(2026, 7, 21, 23, 50));
    expect(window?.endAt).toEqual(localDate(2026, 7, 22, 0, 30));
    expect(window?.windowStartDate).toBe("2026-07-21");
    expect(window?.spansMidnight).toBe(true);
  });

  it("resolves upcoming overnight window before start", () => {
    const now = localDate(2026, 7, 21, 22, 0);
    const window = resolveScheduleWindow("23:00", "01:00", now);
    expect(window?.startAt).toEqual(localDate(2026, 7, 21, 23, 0));
    expect(window?.endAt).toEqual(localDate(2026, 7, 22, 1, 0));
    expect(window?.windowStartDate).toBe("2026-07-21");
    expect(window?.spansMidnight).toBe(true);
  });
});

describe("resolveNextScheduleStartAt", () => {
  it("returns tomorrow start when evening setup targets early morning", () => {
    const now = localDate(2026, 7, 21, 22, 0);
    expect(resolveNextScheduleStartAt("01:00", undefined, now)).toEqual(
      localDate(2026, 7, 22, 1, 0),
    );
  });

  it("returns now when inside a bounded window", () => {
    const now = localDate(2026, 7, 21, 9, 15);
    const next = resolveNextScheduleStartAt("09:00", "10:00", now);
    expect(next?.getTime()).toBe(now.getTime());
  });
});

describe("getSchedulePhase", () => {
  it("returns off when disabled", () => {
    expect(getSchedulePhase(false, "09:00", undefined, localDate(2026, 7, 21, 8, 0))).toBe(
      "off",
    );
  });

  it("returns pending before start", () => {
    expect(getSchedulePhase(true, "09:00", "10:00", localDate(2026, 7, 21, 8, 0))).toBe(
      "pending",
    );
  });

  it("returns pending inside window before start fired", () => {
    expect(getSchedulePhase(true, "09:00", "10:00", localDate(2026, 7, 21, 9, 15))).toBe(
      "pending",
    );
  });

  it("returns pending for early-morning start configured in the evening", () => {
    expect(getSchedulePhase(true, "01:00", undefined, localDate(2026, 7, 21, 22, 0))).toBe(
      "pending",
    );
  });

  it("returns pending before overnight window start", () => {
    expect(getSchedulePhase(true, "23:00", "01:00", localDate(2026, 7, 21, 22, 0))).toBe(
      "pending",
    );
  });

  it("returns active when start fired for window", () => {
    const now = localDate(2026, 7, 21, 9, 15);
    expect(getSchedulePhase(true, "09:00", "10:00", now, "2026-07-21")).toBe("active");
  });

  it("returns ended after end time", () => {
    expect(
      getSchedulePhase(true, "09:00", "10:00", localDate(2026, 7, 21, 10, 5), "2026-07-21"),
    ).toBe("ended");
  });

  it("returns active overnight after start fired yesterday", () => {
    const now = localDate(2026, 7, 22, 0, 10);
    expect(
      getSchedulePhase(true, "23:50", "00:30", now, "2026-07-21", undefined),
    ).toBe("active");
  });
});

describe("isInWindowImmediateScheduleStart", () => {
  it("is true inside bounded window before start fired", () => {
    const now = localDate(2026, 7, 21, 9, 15);
    expect(isInWindowImmediateScheduleStart("09:00", "10:00", now)).toBe(true);
  });

  it("is false when no end time is configured", () => {
    const now = localDate(2026, 7, 21, 22, 0);
    expect(isInWindowImmediateScheduleStart("01:00", undefined, now)).toBe(false);
  });
});

describe("nextStartAlarmAt", () => {
  it("returns startAt when now is before start", () => {
    const now = localDate(2026, 7, 21, 8, 0);
    expect(nextStartAlarmAt("09:00", undefined, now)).toEqual(localDate(2026, 7, 21, 9, 0));
  });

  it("returns tomorrow when start passed and not fired", () => {
    const now = localDate(2026, 7, 21, 9, 15);
    expect(nextStartAlarmAt("09:00", undefined, now)).toEqual(localDate(2026, 7, 22, 9, 0));
  });

  it("returns null when already fired for window", () => {
    const now = localDate(2026, 7, 21, 9, 15);
    expect(nextStartAlarmAt("09:00", undefined, now, "2026-07-21")).toBeNull();
  });
});

describe("alarm helpers", () => {
  it("builds and parses alarm names", () => {
    expect(alarmName("target", "start")).toBe("schedule:target:start");
    expect(parseScheduleAlarmName("schedule:samsclub:end")).toEqual({
      retailer: "samsclub",
      kind: "end",
    });
    expect(parseScheduleAlarmName("schedule:rollover")).toEqual({ kind: "rollover" });
  });
});

describe("schedulePhaseStatusLine", () => {
  it("shows countdown to next occurrence for early-morning evening setup", () => {
    const line = schedulePhaseStatusLine(
      "pending",
      "01:00",
      localDate(2026, 7, 21, 22, 0),
      undefined,
      undefined,
    );
    expect(line).toMatch(/^Starts in /);
    expect(line).not.toContain("resumes tomorrow");
  });

  it("prefers action status when set", () => {
    expect(
      schedulePhaseStatusLine(
        "active",
        "09:00",
        localDate(2026, 7, 21, 9, 15),
        "Scheduled start: 2 tab(s)",
      ),
    ).toBe("Scheduled start: 2 tab(s)");
  });

  it("ignores action status when schedule is off or ended", () => {
    expect(
      schedulePhaseStatusLine(
        "off",
        "09:00",
        localDate(2026, 7, 21, 9, 15),
        "Scheduled start: 0 tab(s)",
      ),
    ).toBe("");
    expect(
      schedulePhaseStatusLine(
        "ended",
        "09:00",
        localDate(2026, 7, 21, 10, 5),
        "Scheduled start: 0 tab(s)",
      ),
    ).toBe("Schedule ended for today");
  });
});

describe("msUntil and midnight", () => {
  it("clamps msUntil to zero", () => {
    const now = localDate(2026, 7, 21, 10, 0);
    expect(msUntil(localDate(2026, 7, 21, 9, 0), now)).toBe(0);
  });

  it("computes next local midnight", () => {
    const now = localDate(2026, 7, 21, 22, 0);
    expect(nextLocalMidnight(now)).toEqual(localDate(2026, 7, 22, 0, 0));
    expect(formatLocalDate(now)).toBe("2026-07-21");
  });
});
