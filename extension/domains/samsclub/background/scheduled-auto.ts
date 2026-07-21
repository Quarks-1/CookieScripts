import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { setScheduleActionStatus } from "@ext/core/background/schedule-runtime-state.ts";
import { resolveScheduleWindow } from "@ext/core/lib/schedule.ts";
import { setScheduleStartFiredDate } from "@ext/core/lib/schedule-session.ts";
import {
  getSamsclubScheduleEnabled,
  getSamsclubScheduleEndTime,
  getSamsclubScheduleStartTime,
} from "@ext/core/lib/schedule-settings.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import {
  bindSamsclubTab,
  broadcastSamsclubStopAuto,
  clearSamsclubManualAutoStopped,
  getSamsclubTabPurchaseLimit,
  getSamsclubTabUiState,
  setSamsclubTabUiState,
} from "@ext/domains/samsclub/background/automation-runtime-state.ts";
import {
  getSamsclubAtcQuantity,
  getSamsclubUseMaxQuantity,
} from "@ext/domains/samsclub/lib/channel-config.ts";
import { buildQuantityStatusFields } from "@ext/domains/samsclub/lib/quantity-limit.ts";
import { isSamsclubProductUrl } from "@ext/domains/samsclub/lib/host.ts";

const SAMSCLUB_TAB_QUERY = ["https://www.samsclub.com/*", "https://samsclub.com/*"];

export async function startSamsclubTabAuto(
  tabId: number,
): Promise<{ ok: boolean; error?: string }> {
  bindSamsclubTab(tabId, "manual");
  clearSamsclubManualAutoStopped(tabId);
  setSamsclubTabUiState(tabId, { status: "Starting auto mode…", running: true });
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "SAMSCLUB_START_MANUAL_AUTO",
      hard_refresh: true,
    });
    return { ok: true };
  } catch {
    setSamsclubTabUiState(tabId, { status: "Tab not ready", running: false });
    return { ok: false, error: "Sam's Club tab is not ready — refresh the page" };
  }
}

function formatScheduledStartStatus(
  started: number,
  skippedRunning: number,
  skippedBlocked: number,
  productTabCount: number,
): string {
  if (productTabCount === 0) {
    return "Scheduled start: no product tabs open";
  }
  if (started === 0 && skippedRunning + skippedBlocked > 0) {
    return "Scheduled start: all tabs already running or blocked";
  }
  if (skippedRunning > 0 || skippedBlocked > 0) {
    return `Scheduled start: ${started} started, ${skippedRunning} skipped (running), ${skippedBlocked} blocked`;
  }
  return `Scheduled start: ${started} tab(s)`;
}

export async function startScheduledSamsclubAuto(): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled || !getSamsclubScheduleEnabled(settings)) {
    return;
  }

  const startTime = getSamsclubScheduleStartTime(settings);
  if (!startTime) {
    return;
  }

  const now = new Date();
  const window = resolveScheduleWindow(
    startTime,
    getSamsclubScheduleEndTime(settings) ?? undefined,
    now,
  );
  if (!window) {
    return;
  }

  await setScheduleStartFiredDate("samsclub", window.windowStartDate);

  const tabs = await chrome.tabs.query({ url: SAMSCLUB_TAB_QUERY });
  const productTabs = tabs.filter((tab) => tab.id != null && isSamsclubProductUrl(tab.url ?? ""));

  let started = 0;
  let skippedRunning = 0;
  let skippedBlocked = 0;
  const atcQuantity = getSamsclubAtcQuantity(settings);
  const useMaxQuantity = getSamsclubUseMaxQuantity(settings);

  for (const tab of productTabs) {
    const tabId = tab.id!;
    if (getSamsclubTabUiState(tabId).running) {
      skippedRunning += 1;
      continue;
    }

    const purchaseLimit = getSamsclubTabPurchaseLimit(tabId, tab.url);
    const blocked =
      purchaseLimit !== undefined &&
      buildQuantityStatusFields(atcQuantity, useMaxQuantity, purchaseLimit)
        .samsclub_auto_start_blocked;
    if (blocked) {
      skippedBlocked += 1;
      continue;
    }

    const result = await startSamsclubTabAuto(tabId);
    if (result.ok) {
      started += 1;
    }
  }

  setScheduleActionStatus(
    "samsclub",
    formatScheduledStartStatus(started, skippedRunning, skippedBlocked, productTabs.length),
  );
  void notifyStatusChanged();
}

export async function stopScheduledSamsclubAuto(): Promise<void> {
  await broadcastSamsclubStopAuto();
}
