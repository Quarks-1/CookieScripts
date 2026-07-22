import type { ExtensionSettings } from "@ext/core/types/index.ts";

const HHMMSS_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function isValidScheduleTime(value: string): boolean {
  const match = HHMMSS_PATTERN.exec(value.trim());
  if (!match) {
    return false;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] != null ? Number(match[3]) : 0;
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    Number.isInteger(seconds) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59 &&
    seconds >= 0 &&
    seconds <= 59
  );
}

export function normalizeScheduleTime(value: string): string {
  const match = HHMMSS_PATTERN.exec(value.trim());
  if (!match || !isValidScheduleTime(value)) {
    throw new Error("Invalid schedule time");
  }
  const hours = String(Number(match[1])).padStart(2, "0");
  const minutes = String(Number(match[2])).padStart(2, "0");
  const seconds = String(match[3] != null ? Number(match[3]) : 0).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function getRetailerScheduleEnabled(settings: ExtensionSettings): boolean {
  return settings.retailer_schedule_enabled === true;
}

export function getRetailerScheduleStartTime(settings: ExtensionSettings): string | null {
  const value = settings.retailer_schedule_start_time;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function getRetailerScheduleEndTime(settings: ExtensionSettings): string | null {
  const value = settings.retailer_schedule_end_time;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function getRetailerScheduleStopOnOos(settings: ExtensionSettings): boolean {
  return settings.retailer_schedule_stop_on_oos === true;
}

export function getRetailerCloseTabOnOos(settings: ExtensionSettings): boolean {
  return settings.retailer_close_tab_on_oos === true;
}

export function getSamsclubScheduleEnabled(settings: ExtensionSettings): boolean {
  return settings.samsclub_schedule_enabled === true;
}

export function getSamsclubScheduleStartTime(settings: ExtensionSettings): string | null {
  const value = settings.samsclub_schedule_start_time;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function getSamsclubScheduleEndTime(settings: ExtensionSettings): string | null {
  const value = settings.samsclub_schedule_end_time;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function getSamsclubScheduleStopOnOos(settings: ExtensionSettings): boolean {
  return settings.samsclub_schedule_stop_on_oos === true;
}

export type RetailerSchedulePatch = {
  enabled?: boolean;
  start_time?: string;
  end_time?: string;
  stop_on_oos?: boolean;
  close_tab_on_oos?: boolean;
};

export type SamsclubSchedulePatch = {
  enabled?: boolean;
  start_time?: string;
  end_time?: string;
  stop_on_oos?: boolean;
};

function applyOptionalBoolean(
  next: ExtensionSettings,
  key: keyof ExtensionSettings,
  value: boolean | undefined,
  defaultOff = false,
): void {
  if (value === undefined) {
    return;
  }
  if (value === defaultOff) {
    delete next[key];
  } else {
    (next as unknown as Record<string, unknown>)[key as string] = value;
  }
}

function applyOptionalTime(
  next: ExtensionSettings,
  key: keyof ExtensionSettings,
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    delete next[key];
    return;
  }
  (next as unknown as Record<string, unknown>)[key as string] = normalizeScheduleTime(trimmed);
}

export function mergeRetailerScheduleSettings(
  settings: ExtensionSettings,
  patch: RetailerSchedulePatch,
): ExtensionSettings {
  const next = { ...settings };
  if (patch.enabled !== undefined) {
    if (patch.enabled) {
      next.retailer_schedule_enabled = true;
    } else {
      delete next.retailer_schedule_enabled;
    }
  }

  const enabling = patch.enabled === true;
  const willBeEnabled = patch.enabled ?? getRetailerScheduleEnabled(settings);
  applyOptionalTime(next, "retailer_schedule_start_time", patch.start_time);
  applyOptionalTime(next, "retailer_schedule_end_time", patch.end_time);
  applyOptionalBoolean(next, "retailer_schedule_stop_on_oos", patch.stop_on_oos);
  applyOptionalBoolean(next, "retailer_close_tab_on_oos", patch.close_tab_on_oos);

  if ((enabling || willBeEnabled) && !getRetailerScheduleStartTime(next)) {
    throw new Error("Start time is required when schedule is enabled");
  }

  const start = getRetailerScheduleStartTime(next);
  const end = getRetailerScheduleEndTime(next);
  if (start && end && start === end) {
    throw new Error("End time must differ from start time");
  }

  return next;
}

export function mergeSamsclubScheduleSettings(
  settings: ExtensionSettings,
  patch: SamsclubSchedulePatch,
): ExtensionSettings {
  const next = { ...settings };
  if (patch.enabled !== undefined) {
    if (patch.enabled) {
      next.samsclub_schedule_enabled = true;
    } else {
      delete next.samsclub_schedule_enabled;
    }
  }

  const enabling = patch.enabled === true;
  const willBeEnabled = patch.enabled ?? getSamsclubScheduleEnabled(settings);
  applyOptionalTime(next, "samsclub_schedule_start_time", patch.start_time);
  applyOptionalTime(next, "samsclub_schedule_end_time", patch.end_time);
  applyOptionalBoolean(next, "samsclub_schedule_stop_on_oos", patch.stop_on_oos);

  if ((enabling || willBeEnabled) && !getSamsclubScheduleStartTime(next)) {
    throw new Error("Start time is required when schedule is enabled");
  }

  const start = getSamsclubScheduleStartTime(next);
  const end = getSamsclubScheduleEndTime(next);
  if (start && end && start === end) {
    throw new Error("End time must differ from start time");
  }

  return next;
}
