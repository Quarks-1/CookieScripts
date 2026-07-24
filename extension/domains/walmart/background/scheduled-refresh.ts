import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { setScheduleActionStatus } from "@ext/core/background/schedule-runtime-state.ts";
import { resolveScheduleWindow } from "@ext/core/lib/schedule.ts";
import { readScheduleSession, setScheduleStartFiredDate } from "@ext/core/lib/schedule-session.ts";
import {
  getWalmartScheduleEnabled,
  getWalmartScheduleEndTime,
  getWalmartScheduleStartTime,
} from "@ext/core/lib/schedule-settings.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import {
  pushWalmartAutoRefreshConfigToTab,
} from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import {
  getWalmartTabAutoRefresh,
  hasWalmartTabAutoRefresh,
  listWalmartTabAutoRefreshTabIds,
  setWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { listAllWalmartTabs } from "@ext/domains/walmart/background/tabs.ts";
import { getWalmartFallbackIntervalSec } from "@ext/domains/walmart/lib/auto-refresh.ts";

function formatScheduledRefreshStatus(started: number, tabCount: number): string {
  if (tabCount === 0) {
    return "Scheduled refresh: no Walmart tabs open";
  }
  return `Scheduled refresh: ${started} tab(s)`;
}

export async function isWalmartScheduleWindowActive(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.enabled || !getWalmartScheduleEnabled(settings)) {
    return false;
  }

  const startTime = getWalmartScheduleStartTime(settings);
  if (!startTime) {
    return false;
  }

  const now = new Date();
  const window = resolveScheduleWindow(
    startTime,
    getWalmartScheduleEndTime(settings) ?? undefined,
    now,
  );
  if (!window) {
    return false;
  }

  const session = await readScheduleSession("walmart");
  if (session.start_fired_date !== window.windowStartDate) {
    return false;
  }

  const nowMs = now.getTime();
  return window.endAt == null || nowMs < window.endAt.getTime();
}

function resolveIntervalForTab(tabId: number, fallbackInterval: number): number {
  return getWalmartTabAutoRefresh(tabId)?.interval_sec ?? fallbackInterval;
}

async function writeScheduledRefreshEntry(
  tabId: number,
  fallbackInterval: number,
  lastRefreshAt?: number,
): Promise<void> {
  const intervalSec = resolveIntervalForTab(tabId, fallbackInterval);
  setWalmartTabAutoRefresh(tabId, {
    enabled: true,
    interval_sec: intervalSec,
    last_refresh_at: lastRefreshAt,
  });
}

export async function startScheduledWalmartRefresh(): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled || !getWalmartScheduleEnabled(settings)) {
    return;
  }

  const startTime = getWalmartScheduleStartTime(settings);
  if (!startTime) {
    return;
  }

  const now = new Date();
  const window = resolveScheduleWindow(
    startTime,
    getWalmartScheduleEndTime(settings) ?? undefined,
    now,
  );
  if (!window) {
    return;
  }

  await setScheduleStartFiredDate("walmart", window.windowStartDate);

  const fallbackInterval = getWalmartFallbackIntervalSec(settings);
  const tabs = await listAllWalmartTabs();
  const tabIds = tabs.filter((tab) => tab.id != null).map((tab) => tab.id!);
  const lastRefreshAt = Date.now();

  for (const tabId of tabIds) {
    await writeScheduledRefreshEntry(tabId, fallbackInterval, lastRefreshAt);
    await chrome.tabs.reload(tabId, { bypassCache: true });
  }

  setScheduleActionStatus(
    "walmart",
    formatScheduledRefreshStatus(tabIds.length, tabIds.length),
  );
  void notifyStatusChanged();
}

export async function resumeScheduledWalmartRefresh(): Promise<void> {
  if (!(await isWalmartScheduleWindowActive())) {
    return;
  }

  const settings = await getSettings();
  const fallbackInterval = getWalmartFallbackIntervalSec(settings);
  const tabs = await listAllWalmartTabs();
  let started = 0;

  for (const tab of tabs) {
    const tabId = tab.id;
    if (tabId == null || hasWalmartTabAutoRefresh(tabId)) {
      continue;
    }

    await writeScheduledRefreshEntry(tabId, fallbackInterval, Date.now());
    const entry = getWalmartTabAutoRefresh(tabId);
    if (!entry) {
      continue;
    }
    await pushWalmartAutoRefreshConfigToTab(tabId, {
      enabled: entry.enabled,
      interval_sec: entry.interval_sec,
      pause: false,
      last_refresh_at: entry.last_refresh_at,
    });
    started += 1;
  }

  if (started > 0) {
    setScheduleActionStatus(
      "walmart",
      formatScheduledRefreshStatus(started, tabs.filter((tab) => tab.id != null).length),
    );
    void notifyStatusChanged();
  }
}

export async function seedScheduledWalmartRefreshForTab(tabId: number): Promise<void> {
  if (!(await isWalmartScheduleWindowActive()) || hasWalmartTabAutoRefresh(tabId)) {
    return;
  }

  const settings = await getSettings();
  const fallbackInterval = getWalmartFallbackIntervalSec(settings);
  await writeScheduledRefreshEntry(tabId, fallbackInterval, Date.now());
}

export async function stopScheduledWalmartRefresh(): Promise<void> {
  const tabIds = listWalmartTabAutoRefreshTabIds();

  for (const tabId of tabIds) {
    const existing = getWalmartTabAutoRefresh(tabId);
    if (!existing) {
      continue;
    }

    const next = {
      ...existing,
      enabled: false,
    };
    setWalmartTabAutoRefresh(tabId, next);
    await pushWalmartAutoRefreshConfigToTab(tabId, {
      enabled: false,
      interval_sec: next.interval_sec,
      pause: false,
      last_refresh_at: next.last_refresh_at,
    });
  }
}
