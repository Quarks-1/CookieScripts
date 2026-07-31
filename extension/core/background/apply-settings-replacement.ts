import {
  clearAllScheduleAlarms,
  resetScheduleRuntimeForRetailer,
  syncScheduleAlarms,
} from "@ext/core/background/schedule-alarms.ts";
import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import {
  clearAllScheduleActionStatus,
} from "@ext/core/background/schedule-runtime-state.ts";
import { clearAllScheduleSession } from "@ext/core/lib/schedule-session.ts";
import type { ExtensionSettings } from "@ext/core/types/index.ts";
import {
  broadcastRetailerStopAuto,
} from "@ext/domains/target/background/runtime-state.ts";
import { stopScheduledTargetAuto } from "@ext/domains/target/background/scheduled-auto.ts";
import {
  stopAllWalmartRecordingsForDisable,
} from "@ext/domains/walmart/background/handlers/index.ts";
import {
  reconcileWalmartAutoRefreshInterval,
  stopAllWalmartAutoRefreshForDisable,
} from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import { stopScheduledWalmartRefresh } from "@ext/domains/walmart/background/scheduled-refresh.ts";
import { getWalmartFallbackIntervalSec } from "@ext/domains/walmart/lib/index.ts";
import {
  broadcastSamsclubStopAuto,
} from "@ext/domains/samsclub/background/automation-runtime-state.ts";
import {
  stopAllSamsclubRecordingsForDisable,
} from "@ext/domains/samsclub/background/handlers/index.ts";
import { stopScheduledSamsclubAuto } from "@ext/domains/samsclub/background/scheduled-auto.ts";

type ScheduleRetailer = "target" | "walmart" | "samsclub";

function scheduleSnapshot(
  settings: ExtensionSettings,
  retailer: ScheduleRetailer,
): Record<string, boolean | string | undefined> {
  switch (retailer) {
    case "target":
      return {
        enabled: settings.retailer_schedule_enabled,
        start: settings.retailer_schedule_start_time,
        end: settings.retailer_schedule_end_time,
        stop_on_oos: settings.retailer_schedule_stop_on_oos,
        close_tab_on_oos: settings.retailer_close_tab_on_oos,
      };
    case "samsclub":
      return {
        enabled: settings.samsclub_schedule_enabled,
        start: settings.samsclub_schedule_start_time,
        end: settings.samsclub_schedule_end_time,
        stop_on_oos: settings.samsclub_schedule_stop_on_oos,
      };
    case "walmart":
      return {
        enabled: settings.walmart_schedule_enabled,
        start: settings.walmart_schedule_start_time,
        end: settings.walmart_schedule_end_time,
      };
  }
}

function scheduleFieldsChanged(
  previous: ExtensionSettings,
  next: ExtensionSettings,
  retailer: ScheduleRetailer,
): boolean {
  return (
    JSON.stringify(scheduleSnapshot(previous, retailer)) !==
    JSON.stringify(scheduleSnapshot(next, retailer))
  );
}

async function resetRetailerScheduleRuntime(retailer: ScheduleRetailer): Promise<void> {
  switch (retailer) {
    case "target":
      await stopScheduledTargetAuto();
      break;
    case "samsclub":
      await stopScheduledSamsclubAuto();
      break;
    case "walmart":
      await stopScheduledWalmartRefresh();
      break;
  }
  await resetScheduleRuntimeForRetailer(retailer);
}

async function runDisableTeardown(): Promise<void> {
  await stopAllWalmartRecordingsForDisable();
  await stopAllWalmartAutoRefreshForDisable();
  await stopAllSamsclubRecordingsForDisable();
  clearAllScheduleActionStatus();
  await clearAllScheduleSession();
  await clearAllScheduleAlarms();
  await broadcastRetailerStopAuto();
  await broadcastSamsclubStopAuto();
}

export async function applySettingsReplacementSideEffects(
  previous: ExtensionSettings,
  next: ExtensionSettings,
): Promise<{ runtimeSyncFailed?: true }> {
  try {
    if (previous.enabled && !next.enabled) {
      await runDisableTeardown();
    } else {
      const retailers: ScheduleRetailer[] = ["target", "walmart", "samsclub"];
      for (const retailer of retailers) {
        if (scheduleFieldsChanged(previous, next, retailer)) {
          await resetRetailerScheduleRuntime(retailer);
        }
      }
      await syncScheduleAlarms(next);
      if (
        getWalmartFallbackIntervalSec(previous) !==
        getWalmartFallbackIntervalSec(next)
      ) {
        await reconcileWalmartAutoRefreshInterval(next);
      }
    }
    void notifyStatusChanged();
    return {};
  } catch (error) {
    console.error("CookieScripts: settings runtime sync failed", error);
    return { runtimeSyncFailed: true };
  }
}
