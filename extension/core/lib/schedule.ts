export type SchedulePhase = "off" | "pending" | "active" | "ended";

export type ScheduleRetailer = "target" | "samsclub";

export type ScheduleWindow = {
  startAt: Date;
  endAt: Date | null;
  spansMidnight: boolean;
  windowStartDate: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const HHMMSS_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalTimeOnDate(hhmmss: string, now: Date): Date | null {
  const match = HHMMSS_PATTERN.exec(hhmmss.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] != null ? Number(match[3]) : 0;
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  const result = new Date(now);
  result.setHours(hours, minutes, seconds, 0);
  return result;
}

export function resolveScheduleWindow(
  start: string,
  end: string | undefined,
  now: Date,
): ScheduleWindow | null {
  const startAt = parseLocalTimeOnDate(start, now);
  if (!startAt) {
    return null;
  }

  let endAt: Date | null = null;
  let spansMidnight = false;

  if (end != null && end.trim() !== "") {
    const parsedEnd = parseLocalTimeOnDate(end, now);
    if (!parsedEnd) {
      return null;
    }
    endAt = parsedEnd;
    if (endAt.getTime() <= startAt.getTime()) {
      endAt = new Date(endAt.getTime() + MS_PER_DAY);
      spansMidnight = true;
    }
  }

  const nowMs = now.getTime();
  if (spansMidnight && endAt != null && end != null && end.trim() !== "") {
    const endOnToday = parseLocalTimeOnDate(end, now);
    if (endOnToday && nowMs < endOnToday.getTime()) {
      startAt.setTime(startAt.getTime() - MS_PER_DAY);
      endAt.setTime(endAt.getTime() - MS_PER_DAY);
    }
  }

  return {
    startAt,
    endAt,
    spansMidnight,
    windowStartDate: formatLocalDate(startAt),
  };
}

export function resolveNextScheduleStartAt(
  start: string,
  end: string | undefined,
  now: Date,
  startFiredDate?: string,
): Date | null {
  const window = resolveScheduleWindow(start, end, now);
  if (!window) {
    return null;
  }

  const { startAt, endAt, windowStartDate } = window;
  if (startFiredDate === windowStartDate) {
    return null;
  }

  const nowMs = now.getTime();
  if (nowMs < startAt.getTime()) {
    return startAt;
  }

  if (endAt != null && nowMs >= startAt.getTime() && nowMs < endAt.getTime()) {
    return now;
  }

  return new Date(startAt.getTime() + MS_PER_DAY);
}

export function isInWindowImmediateScheduleStart(
  start: string,
  end: string | undefined,
  now: Date,
  startFiredDate?: string,
): boolean {
  const window = resolveScheduleWindow(start, end, now);
  if (!window || window.endAt == null) {
    return false;
  }

  if (startFiredDate === window.windowStartDate) {
    return false;
  }

  const nowMs = now.getTime();
  return nowMs >= window.startAt.getTime() && nowMs < window.endAt.getTime();
}

export function getSchedulePhase(
  enabled: boolean,
  start: string | undefined,
  end: string | undefined,
  now: Date,
  startFiredDate?: string,
  endFiredDate?: string,
): SchedulePhase {
  if (!enabled || !start) {
    return "off";
  }

  const window = resolveScheduleWindow(start, end, now);
  if (!window) {
    return "off";
  }

  const { startAt, endAt, windowStartDate } = window;
  const nowMs = now.getTime();
  const startFiredForWindow = startFiredDate === windowStartDate;

  if (endAt != null && (nowMs >= endAt.getTime() || endFiredDate === windowStartDate)) {
    return "ended";
  }

  if (startFiredForWindow && nowMs >= startAt.getTime() && (endAt == null || nowMs < endAt.getTime())) {
    return "active";
  }

  if (!startFiredForWindow && resolveNextScheduleStartAt(start, end, now, startFiredDate) != null) {
    return "pending";
  }

  return "off";
}

export function nextStartAlarmAt(
  start: string,
  end: string | undefined,
  now: Date,
  startFiredDate?: string,
): Date | null {
  return resolveNextScheduleStartAt(start, end, now, startFiredDate);
}

export function msUntil(when: Date, now: Date): number {
  return Math.max(0, when.getTime() - now.getTime());
}

export function nextLocalMidnight(now: Date): Date {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

export function alarmName(
  retailer: ScheduleRetailer,
  kind: "start" | "end" | "rollover",
): string {
  if (kind === "rollover") {
    return "schedule:rollover";
  }
  return `schedule:${retailer}:${kind}`;
}

export function isScheduleAlarmName(name: string): boolean {
  return name.startsWith("schedule:");
}

export function parseScheduleAlarmName(
  name: string,
): { retailer: ScheduleRetailer; kind: "start" | "end" } | { kind: "rollover" } | null {
  if (name === "schedule:rollover") {
    return { kind: "rollover" };
  }
  const match = /^schedule:(target|samsclub):(start|end)$/.exec(name);
  if (!match) {
    return null;
  }
  return {
    retailer: match[1] as ScheduleRetailer,
    kind: match[2] as "start" | "end",
  };
}

export function formatScheduleCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function schedulePhaseStatusLine(
  phase: SchedulePhase,
  startTime: string | null,
  now: Date,
  actionStatus?: string,
  endTime?: string | null,
  startFiredDate?: string,
): string {
  const trimmedAction = actionStatus?.trim() ?? "";
  if (trimmedAction !== "" && (phase === "pending" || phase === "active")) {
    return trimmedAction;
  }
  switch (phase) {
    case "pending": {
      if (!startTime) {
        return "Schedule pending";
      }
      const nextStart = resolveNextScheduleStartAt(
        startTime,
        endTime ?? undefined,
        now,
        startFiredDate,
      );
      if (!nextStart) {
        return "Schedule pending";
      }
      return `Starts in ${formatScheduleCountdown(msUntil(nextStart, now))}`;
    }
    case "active":
      return "Schedule active";
    case "ended":
      return "Schedule ended for today";
    case "off":
    default:
      return "";
  }
}
