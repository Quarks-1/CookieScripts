import type { RetailerAutoCheckoutMode, SamsclubAutoCheckoutMode } from "@ext/core/types/index.ts";
import {
  buildStatus,
  setRetailerAtcModesForSettings,
  setRetailerAtcQuantityForSettings,
  setRetailerAutoAtcEnabledGlobal,
  setRetailerAutoCheckoutModeForSettings,
  setRetailerRefreshIntervalForChannel,
  setSamsclubAtcModesForSettings,
  setSamsclubAtcQuantityForSettings,
  setSamsclubAutoCheckoutModeForSettings,
  setSamsclubCheckoutCvvForSettings,
  setSamsclubRefreshIntervalGlobal,
} from "@ext/core/background/status.ts";
import { RETAILER_AUTO_CHECKOUT_MODES } from "@ext/domains/target/lib/channel-config.ts";
import {
  normalizeSamsclubCheckoutCvv,
  SAMSCLUB_AUTO_CHECKOUT_MODES,
} from "@ext/domains/samsclub/lib/index.ts";
import {
  clearAllScheduleAlarms,
  resetScheduleRuntimeForRetailer,
  syncScheduleAlarms,
} from "@ext/core/background/schedule-alarms.ts";
import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { clearAllScheduleActionStatus } from "@ext/core/background/schedule-runtime-state.ts";
import { clearAllScheduleSession } from "@ext/core/lib/schedule-session.ts";
import { getActiveRetailerTabInWindow } from "@ext/domains/target/background/tab-message.ts";
import { getActiveSamsclubTabInWindow } from "@ext/domains/samsclub/background/tab-message.ts";
import { getActiveTabInWindow } from "@ext/core/background/window-active-tab.ts";
import {
  broadcastRetailerStopAuto,
  stopRetailerTabAuto,
} from "@ext/domains/target/background/runtime-state.ts";
import { startRetailerTabAuto } from "@ext/domains/target/background/scheduled-auto.ts";
import { stopScheduledTargetAuto } from "@ext/domains/target/background/scheduled-auto.ts";
import {
  clearHistory,
  getHistory,
  getSettings,
  saveSettings,
} from "@ext/core/lib/storage.ts";
import { clearRecentUrlKeys } from "@ext/core/background/runtime-state.ts";
import {
  handleWalmartUiMessage,
  stopAllWalmartRecordingsForDisable,
} from "@ext/domains/walmart/background/handlers/index.ts";
import {
  handleSamsclubUiMessage,
  stopAllSamsclubRecordingsForDisable,
} from "@ext/domains/samsclub/background/handlers/index.ts";
import {
  broadcastSamsclubStopAuto,
  stopSamsclubTabAuto,
} from "@ext/domains/samsclub/background/automation-runtime-state.ts";
import { startSamsclubTabAuto } from "@ext/domains/samsclub/background/scheduled-auto.ts";
import { stopScheduledSamsclubAuto } from "@ext/domains/samsclub/background/scheduled-auto.ts";
import {
  mergeRetailerScheduleSettings,
  mergeSamsclubScheduleSettings,
} from "@ext/core/lib/schedule-settings.ts";
import {
  handleSetWalmartAutoRefreshEnabled,
  handleSetWalmartRefreshInterval,
  stopAllWalmartAutoRefreshForDisable,
} from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import type { BackgroundResponse, UiToBackground } from "@ext/core/types/index.ts";

export async function handleUiMessage(
  message: UiToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  void sender;

  switch (message.type) {
    case "GET_STATUS": {
      const activeTab = await getActiveTabInWindow(message.window_id);
      const status = await buildStatus(activeTab);
      return { ok: true, status };
    }
    case "GET_SETTINGS": {
      const settings = await getSettings();
      const { samsclub_checkout_cvv: _cvv, ...safeSettings } = settings;
      return { ok: true, settings: safeSettings };
    }
    case "SAVE_SETTINGS": {
      try {
        const previous = await getSettings();
        await saveSettings(message.settings);
        if (previous.enabled && !message.settings.enabled) {
          await stopAllWalmartRecordingsForDisable();
          await stopAllWalmartAutoRefreshForDisable();
          await stopAllSamsclubRecordingsForDisable();
          clearAllScheduleActionStatus();
          await clearAllScheduleSession();
          await clearAllScheduleAlarms();
          await broadcastRetailerStopAuto();
          await broadcastSamsclubStopAuto();
          void notifyStatusChanged();
        } else {
          await syncScheduleAlarms(message.settings);
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_RETAILER_AUTO_ATC_ENABLED": {
      try {
        await setRetailerAutoAtcEnabledGlobal(message.enabled);
        if (!message.enabled) {
          await broadcastRetailerStopAuto();
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_RETAILER_REFRESH_INTERVAL": {
      try {
        await setRetailerRefreshIntervalForChannel(message.channel_id, message.interval_sec);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_RETAILER_ATC_MODES": {
      try {
        await setRetailerAtcModesForSettings(message.frontend_enabled, message.backend_enabled);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_RETAILER_ATC_QUANTITY": {
      try {
        await setRetailerAtcQuantityForSettings(message.quantity, message.use_max_quantity);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_RETAILER_AUTO_CHECKOUT_MODE": {
      if (!RETAILER_AUTO_CHECKOUT_MODES.has(message.mode)) {
        return { ok: false, error: "Invalid auto checkout mode" };
      }
      try {
        await setRetailerAutoCheckoutModeForSettings(message.mode as RetailerAutoCheckoutMode);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "GET_HISTORY": {
      const history = await getHistory();
      return { ok: true, history };
    }
    case "CLEAR_HISTORY": {
      await clearHistory();
      clearRecentUrlKeys();
      return { ok: true };
    }
    case "GET_DETECTED_DOMAINS": {
      const activeTab = await getActiveTabInWindow(message.window_id);
      if (
        activeTab?.id == null ||
        !activeTab.url?.startsWith("https://discord.com/channels/")
      ) {
        return { ok: true, domains: [] };
      }
      try {
        const response = (await chrome.tabs.sendMessage(activeTab.id, {
          type: "SCAN_DETECTED_DOMAINS",
        })) as { ok?: boolean; domains?: string[] } | undefined;
        if (response?.ok === true && Array.isArray(response.domains)) {
          return { ok: true, domains: response.domains };
        }
      } catch {
        // Content script may not be injected yet.
      }
      return { ok: true, domains: [] };
    }
    case "RETAILER_START_MANUAL_AUTO": {
      const tab = await getActiveRetailerTabInWindow(message.window_id);
      if (!tab?.id) {
        return { ok: false, error: "Open a Target tab in this window" };
      }
      const result = await startRetailerTabAuto(tab.id);
      if (!result.ok) {
        return { ok: false, error: result.error ?? "Failed to start auto mode" };
      }
      return { ok: true };
    }
    case "RETAILER_STOP_MANUAL_AUTO": {
      const tab = await getActiveRetailerTabInWindow(message.window_id);
      if (!tab?.id) {
        return { ok: false, error: "Open a Target tab in this window" };
      }
      await stopRetailerTabAuto(tab.id);
      return { ok: true };
    }
    case "WALMART_RECORDING":
      return handleWalmartUiMessage(message);
    case "SET_WALMART_AUTO_REFRESH_ENABLED":
      return handleSetWalmartAutoRefreshEnabled(message);
    case "SET_WALMART_REFRESH_INTERVAL":
      return handleSetWalmartRefreshInterval(message);
    case "SAMSCLUB_RECORDING":
      return handleSamsclubUiMessage(message);
    case "SET_SAMSCLUB_REFRESH_INTERVAL": {
      try {
        await setSamsclubRefreshIntervalGlobal(message.interval_sec);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_SAMSCLUB_ATC_MODES": {
      try {
        await setSamsclubAtcModesForSettings(message.frontend_enabled, message.backend_enabled);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_SAMSCLUB_ATC_QUANTITY": {
      try {
        await setSamsclubAtcQuantityForSettings(message.quantity, message.use_max_quantity);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_SAMSCLUB_AUTO_CHECKOUT_MODE": {
      if (!SAMSCLUB_AUTO_CHECKOUT_MODES.has(message.mode)) {
        return { ok: false, error: "Invalid auto checkout mode" };
      }
      try {
        await setSamsclubAutoCheckoutModeForSettings(message.mode as SamsclubAutoCheckoutMode);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_SAMSCLUB_CHECKOUT_CVV": {
      const trimmed = message.cvv.trim();
      if (trimmed !== "" && normalizeSamsclubCheckoutCvv(trimmed) == null) {
        return { ok: false, error: "CVV must be exactly 3 digits" };
      }
      try {
        await setSamsclubCheckoutCvvForSettings(trimmed);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SAMSCLUB_START_MANUAL_AUTO": {
      const tab = await getActiveSamsclubTabInWindow(message.window_id);
      if (!tab?.id) {
        return { ok: false, error: "Open a Sam's Club tab in this window" };
      }
      const result = await startSamsclubTabAuto(tab.id);
      if (!result.ok) {
        return { ok: false, error: result.error ?? "Failed to start auto mode" };
      }
      return { ok: true };
    }
    case "SAMSCLUB_STOP_MANUAL_AUTO": {
      const tab = await getActiveSamsclubTabInWindow(message.window_id);
      if (!tab?.id) {
        return { ok: false, error: "Open a Sam's Club tab in this window" };
      }
      await stopSamsclubTabAuto(tab.id);
      return { ok: true };
    }
    case "SET_RETAILER_SCHEDULE": {
      try {
        const settings = await getSettings();
        const next = mergeRetailerScheduleSettings(settings, message);
        await saveSettings(next);
        if (message.enabled === false) {
          await stopScheduledTargetAuto();
          await resetScheduleRuntimeForRetailer("target");
        }
        await syncScheduleAlarms(next);
        void notifyStatusChanged();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Save failed",
        };
      }
    }
    case "SET_SAMSCLUB_SCHEDULE": {
      try {
        const settings = await getSettings();
        const next = mergeSamsclubScheduleSettings(settings, message);
        await saveSettings(next);
        if (message.enabled === false) {
          await stopScheduledSamsclubAuto();
          await resetScheduleRuntimeForRetailer("samsclub");
        }
        await syncScheduleAlarms(next);
        void notifyStatusChanged();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Save failed",
        };
      }
    }
  }
}
