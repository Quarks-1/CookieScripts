import {
  alarmName,
  isInWindowImmediateScheduleStart,
  isScheduleAlarmName,
  nextLocalMidnight,
  nextStartAlarmAt,
  parseScheduleAlarmName,
  resolveScheduleWindow,
  type ScheduleRetailer,
} from "@ext/core/lib/schedule.ts";
import {
  clearAllScheduleSession,
  clearScheduleSession,
  readScheduleSession,
  setScheduleEndFiredDate,
} from "@ext/core/lib/schedule-session.ts";
import {
  clearAllScheduleActionStatus,
  clearScheduleActionStatus,
} from "@ext/core/background/schedule-runtime-state.ts";
import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import type { ExtensionSettings } from "@ext/core/types/index.ts";
import {
  getRetailerScheduleEnabled,
  getRetailerScheduleEndTime,
  getRetailerScheduleStartTime,
  getSamsclubScheduleEnabled,
  getSamsclubScheduleEndTime,
  getSamsclubScheduleStartTime,
  getWalmartScheduleEnabled,
  getWalmartScheduleEndTime,
  getWalmartScheduleStartTime,
} from "@ext/core/lib/schedule-settings.ts";
import {
  startScheduledSamsclubAuto,
  stopScheduledSamsclubAuto,
} from "@ext/domains/samsclub/background/scheduled-auto.ts";
import {
  resumeScheduledWalmartRefresh,
  startScheduledWalmartRefresh,
  stopScheduledWalmartRefresh,
} from "@ext/domains/walmart/background/scheduled-refresh.ts";
import {
  startScheduledTargetAuto,
  stopScheduledTargetAuto,
} from "@ext/domains/target/background/scheduled-auto.ts";

type RetailerScheduleConfig = {
  retailer: ScheduleRetailer;
  enabled: boolean;
  startTime: string | null;
  endTime: string | null;
};

const SCHEDULE_ACTIONS: Record<
  ScheduleRetailer,
  { start(): Promise<void>; stop(): Promise<void>; resume?(): Promise<void> }
> = {
  target: { start: startScheduledTargetAuto, stop: stopScheduledTargetAuto },
  samsclub: { start: startScheduledSamsclubAuto, stop: stopScheduledSamsclubAuto },
  walmart: {
    start: startScheduledWalmartRefresh,
    stop: stopScheduledWalmartRefresh,
    resume: resumeScheduledWalmartRefresh,
  },
};

function getRetailerScheduleConfig(settings: ExtensionSettings): RetailerScheduleConfig {
  return {
    retailer: "target",
    enabled: getRetailerScheduleEnabled(settings),
    startTime: getRetailerScheduleStartTime(settings),
    endTime: getRetailerScheduleEndTime(settings),
  };
}

function getSamsclubScheduleConfig(settings: ExtensionSettings): RetailerScheduleConfig {
  return {
    retailer: "samsclub",
    enabled: getSamsclubScheduleEnabled(settings),
    startTime: getSamsclubScheduleStartTime(settings),
    endTime: getSamsclubScheduleEndTime(settings),
  };
}

function getWalmartScheduleConfig(settings: ExtensionSettings): RetailerScheduleConfig {
  return {
    retailer: "walmart",
    enabled: getWalmartScheduleEnabled(settings),
    startTime: getWalmartScheduleStartTime(settings),
    endTime: getWalmartScheduleEndTime(settings),
  };
}

function getScheduleConfigForRetailer(
  settings: ExtensionSettings,
  retailer: ScheduleRetailer,
): RetailerScheduleConfig {
  switch (retailer) {
    case "target":
      return getRetailerScheduleConfig(settings);
    case "samsclub":
      return getSamsclubScheduleConfig(settings);
    case "walmart":
      return getWalmartScheduleConfig(settings);
  }
}

export async function clearAllScheduleAlarms(): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => isScheduleAlarmName(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name)),
  );
}

async function armAlarmAt(name: string, when: Date): Promise<void> {
  const whenMs = when.getTime();
  if (!Number.isFinite(whenMs)) {
    return;
  }
  await chrome.alarms.create(name, { when: whenMs });
}

async function syncRetailerAlarms(
  settings: ExtensionSettings,
  config: RetailerScheduleConfig,
  now: Date,
): Promise<void> {
  const actions = SCHEDULE_ACTIONS[config.retailer];
  const startAlarm = alarmName(config.retailer, "start");
  const endAlarm = alarmName(config.retailer, "end");
  await chrome.alarms.clear(startAlarm);
  await chrome.alarms.clear(endAlarm);

  if (!settings.enabled || !config.enabled || !config.startTime) {
    return;
  }

  const session = await readScheduleSession(config.retailer);
  const window = resolveScheduleWindow(config.startTime, config.endTime ?? undefined, now);
  if (!window) {
    return;
  }

  if (
    isInWindowImmediateScheduleStart(
      config.startTime,
      config.endTime ?? undefined,
      now,
      session.start_fired_date,
      { treatMissingEndAsUnbounded: config.retailer === "walmart" },
    )
  ) {
    await actions.start();
    void notifyStatusChanged();
    const sessionAfter = await readScheduleSession(config.retailer);
    if (
      window.endAt &&
      now.getTime() < window.endAt.getTime() &&
      sessionAfter.start_fired_date === window.windowStartDate
    ) {
      await armAlarmAt(endAlarm, window.endAt);
    }
    return;
  }

  const nextStart = nextStartAlarmAt(
    config.startTime,
    config.endTime ?? undefined,
    now,
    session.start_fired_date,
  );
  if (nextStart) {
    await armAlarmAt(startAlarm, nextStart);
  }

  const startFiredForWindow = session.start_fired_date === window.windowStartDate;
  if (window.endAt && now.getTime() < window.endAt.getTime() && startFiredForWindow) {
    await armAlarmAt(endAlarm, window.endAt);
  }

  if (
    startFiredForWindow &&
    (window.endAt == null || now.getTime() < window.endAt.getTime())
  ) {
    await actions.resume?.();
  }
}

export async function resetScheduleRuntimeForRetailer(
  retailer: ScheduleRetailer,
): Promise<void> {
  clearScheduleActionStatus(retailer);
  await clearScheduleSession(retailer);
}

export async function syncScheduleAlarms(settings?: ExtensionSettings): Promise<void> {
  const resolvedSettings = settings ?? (await getSettings());
  const now = new Date();
  await syncRetailerAlarms(resolvedSettings, getRetailerScheduleConfig(resolvedSettings), now);
  await syncRetailerAlarms(resolvedSettings, getSamsclubScheduleConfig(resolvedSettings), now);
  await syncRetailerAlarms(resolvedSettings, getWalmartScheduleConfig(resolvedSettings), now);

  const anyScheduleEnabled =
    resolvedSettings.enabled &&
    (getRetailerScheduleConfig(resolvedSettings).enabled ||
      getSamsclubScheduleConfig(resolvedSettings).enabled ||
      getWalmartScheduleConfig(resolvedSettings).enabled);

  await chrome.alarms.clear(alarmName("target", "rollover"));
  if (anyScheduleEnabled) {
    await armAlarmAt(alarmName("target", "rollover"), nextLocalMidnight(now));
  }
}

export async function handleScheduleAlarm(name: string): Promise<void> {
  const parsed = parseScheduleAlarmName(name);
  if (!parsed) {
    return;
  }

  if (parsed.kind === "rollover") {
    clearAllScheduleActionStatus();
    await clearAllScheduleSession();
    await syncScheduleAlarms();
    void notifyStatusChanged();
    return;
  }

  const settings = await getSettings();
  if (!settings.enabled) {
    return;
  }

  const config = getScheduleConfigForRetailer(settings, parsed.retailer);
  const actions = SCHEDULE_ACTIONS[parsed.retailer];

  if (!config.enabled || !config.startTime) {
    return;
  }

  const now = new Date();
  const window = resolveScheduleWindow(config.startTime, config.endTime ?? undefined, now);
  if (!window) {
    return;
  }

  if (parsed.kind === "start") {
    await actions.start();
    void notifyStatusChanged();
    await syncScheduleAlarms(settings);
    return;
  }

  await setScheduleEndFiredDate(parsed.retailer, window.windowStartDate);
  clearScheduleActionStatus(parsed.retailer);
  await actions.stop();
  void notifyStatusChanged();
  await syncScheduleAlarms(settings);
}
