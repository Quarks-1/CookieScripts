import { describe, expect, it } from "vitest";

import {
  alarmName,
  formatLocalDate,
  getSchedulePhase,
  msUntil,
  nextLocalMidnight,
  nextStartAlarmAt,
  parseLocalTimeOnDate,
  parseScheduleAlarmName,
  resolveScheduleWindow,
  schedulePhaseStatusLine,
} from "@ext/core/lib/schedule.ts";

function localDate(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): Date {
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

describe("parseLocalTimeOnDate", () => {
  it("parses HH:mm on the calendar day of now", () => {
    const now = localDate(2026, 7, 21, 14, 30);
    const parsed = parseLocalTimeOnDate("09:00", now);
    expect(parsed).toEqual(localDate(2026, 7, 21, 9, 0));
  });

  it("returns null for invalid input", () => {
    expect(parseLocalTimeOnDate("25:00", localDate(2026, 7, 21, 9, 0))).toBeNull();
    expect(parseLocalTimeOnDate("abc", localDate(2026, 7, 21, 9, 0))).toBeNull();
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

  it("returns passed after start without fired date", () => {
    expect(getSchedulePhase(true, "09:00", "10:00", localDate(2026, 7, 21, 9, 15))).toBe(
      "passed",
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
  it("shows passed message", () => {
    expect(
      schedulePhaseStatusLine("passed", "09:00", localDate(2026, 7, 21, 9, 15)),
    ).toContain("resumes tomorrow");
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
