import type { ScheduleRetailer } from "@ext/core/lib/schedule.ts";

export type ScheduleSessionState = {
  start_fired_date?: string;
  end_fired_date?: string;
};

const SESSION_KEYS: Record<ScheduleRetailer, string> = {
  target: "cookiescripts:schedule:target",
  samsclub: "cookiescripts:schedule:samsclub",
};

export async function readScheduleSession(
  retailer: ScheduleRetailer,
): Promise<ScheduleSessionState> {
  const key = SESSION_KEYS[retailer];
  const result = await chrome.storage.session.get(key);
  const value = result[key];
  if (!value || typeof value !== "object") {
    return {};
  }
  const record = value as ScheduleSessionState;
  return {
    start_fired_date:
      typeof record.start_fired_date === "string" ? record.start_fired_date : undefined,
    end_fired_date:
      typeof record.end_fired_date === "string" ? record.end_fired_date : undefined,
  };
}

export async function writeScheduleSession(
  retailer: ScheduleRetailer,
  state: ScheduleSessionState,
): Promise<void> {
  const key = SESSION_KEYS[retailer];
  const next: ScheduleSessionState = {};
  if (state.start_fired_date) {
    next.start_fired_date = state.start_fired_date;
  }
  if (state.end_fired_date) {
    next.end_fired_date = state.end_fired_date;
  }
  if (Object.keys(next).length === 0) {
    await chrome.storage.session.remove(key);
    return;
  }
  await chrome.storage.session.set({ [key]: next });
}

export async function clearScheduleSession(retailer: ScheduleRetailer): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEYS[retailer]);
}

export async function clearAllScheduleSession(): Promise<void> {
  await chrome.storage.session.remove(Object.values(SESSION_KEYS));
}

export async function setScheduleStartFiredDate(
  retailer: ScheduleRetailer,
  windowStartDate: string,
): Promise<void> {
  const current = await readScheduleSession(retailer);
  await writeScheduleSession(retailer, {
    ...current,
    start_fired_date: windowStartDate,
  });
}

export async function setScheduleEndFiredDate(
  retailer: ScheduleRetailer,
  windowStartDate: string,
): Promise<void> {
  const current = await readScheduleSession(retailer);
  await writeScheduleSession(retailer, {
    ...current,
    end_fired_date: windowStartDate,
  });
}
