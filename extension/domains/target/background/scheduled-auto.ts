import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { setScheduleActionStatus } from "@ext/core/background/schedule-runtime-state.ts";
import { resolveScheduleWindow } from "@ext/core/lib/schedule.ts";
import { setScheduleStartFiredDate } from "@ext/core/lib/schedule-session.ts";
import {
  getRetailerScheduleEnabled,
  getRetailerScheduleEndTime,
  getRetailerScheduleStartTime,
} from "@ext/core/lib/schedule-settings.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import {
  bindRetailerTab,
  broadcastRetailerStopAuto,
  clearRetailerManualAutoStopped,
  getRetailerTabPurchaseLimit,
  getRetailerTabUiState,
  setRetailerTabUiState,
} from "@ext/domains/target/background/runtime-state.ts";
import {
  getRetailerAtcQuantity,
  getRetailerUseMaxQuantity,
} from "@ext/domains/target/lib/channel-config.ts";
import { buildQuantityStatusFields } from "@ext/domains/target/lib/quantity-limit.ts";
import { isRetailerProductUrl } from "@ext/domains/target/lib/host.ts";

const TARGET_TAB_QUERY = ["https://www.target.com/*", "https://target.com/*"];

export async function startRetailerTabAuto(
  tabId: number,
): Promise<{ ok: boolean; error?: string }> {
  bindRetailerTab(tabId, "manual");
  clearRetailerManualAutoStopped(tabId);
  setRetailerTabUiState(tabId, { status: "Starting auto mode…", running: true });
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "RETAILER_START_MANUAL_AUTO",
      hard_refresh: true,
    });
    return { ok: true };
  } catch {
    setRetailerTabUiState(tabId, { status: "Tab not ready", running: false });
    return { ok: false, error: "Target tab is not ready — refresh the page" };
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

export async function startScheduledTargetAuto(): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled || !getRetailerScheduleEnabled(settings)) {
    return;
  }

  const startTime = getRetailerScheduleStartTime(settings);
  if (!startTime) {
    return;
  }

  const now = new Date();
  const window = resolveScheduleWindow(startTime, getRetailerScheduleEndTime(settings) ?? undefined, now);
  if (!window) {
    return;
  }

  await setScheduleStartFiredDate("target", window.windowStartDate);

  const tabs = await chrome.tabs.query({ url: TARGET_TAB_QUERY });
  const productTabs = tabs.filter((tab) => tab.id != null && isRetailerProductUrl(tab.url ?? ""));

  let started = 0;
  let skippedRunning = 0;
  let skippedBlocked = 0;
  const atcQuantity = getRetailerAtcQuantity(settings);
  const useMaxQuantity = getRetailerUseMaxQuantity(settings);

  for (const tab of productTabs) {
    const tabId = tab.id!;
    if (getRetailerTabUiState(tabId).running) {
      skippedRunning += 1;
      continue;
    }

    const purchaseLimit = getRetailerTabPurchaseLimit(tabId, tab.url);
    const blocked =
      purchaseLimit !== undefined &&
      buildQuantityStatusFields(atcQuantity, useMaxQuantity, purchaseLimit)
        .retailer_auto_start_blocked;
    if (blocked) {
      skippedBlocked += 1;
      continue;
    }

    const result = await startRetailerTabAuto(tabId);
    if (result.ok) {
      started += 1;
    }
  }

  setScheduleActionStatus(
    "target",
    formatScheduledStartStatus(started, skippedRunning, skippedBlocked, productTabs.length),
  );
  void notifyStatusChanged();
}

export async function stopScheduledTargetAuto(): Promise<void> {
  await broadcastRetailerStopAuto();
}
