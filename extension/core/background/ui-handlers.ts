import type { RetailerAutoCheckoutMode, SamsclubAutoCheckoutMode } from "@ext/core/types/index.ts";
import { applySettingsReplacementSideEffects } from "@ext/core/background/apply-settings-replacement.ts";
import {
  buildStatus,
  setRetailerAtcModesForSettings,
  setRetailerAtcQuantityForSettings,
  setRetailerAutoCheckoutModeForSettings,
  setRetailerPriceGateEnabledForSettings,
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
  resetScheduleRuntimeForRetailer,
  syncScheduleAlarms,
} from "@ext/core/background/schedule-alarms.ts";
import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { getActiveRetailerTabInWindow } from "@ext/domains/target/background/tab-message.ts";
import { getActiveSamsclubTabInWindow } from "@ext/domains/samsclub/background/tab-message.ts";
import { getActiveTabInWindow } from "@ext/core/background/window-active-tab.ts";
import {
  stopRetailerTabAuto,
} from "@ext/domains/target/background/runtime-state.ts";
import { startRetailerTabAuto } from "@ext/domains/target/background/scheduled-auto.ts";
import { stopScheduledTargetAuto } from "@ext/domains/target/background/scheduled-auto.ts";
import {
  clearHistory,
  getHistory,
  getSettings,
  getSettingsImportRevision,
  loadSettingsBackupBundle,
  saveSettings,
  saveSettingsBackupBundle,
} from "@ext/core/lib/storage.ts";
import {
  backupContainsCvv,
  buildImportSummary,
  parseSettingsBackupBlob,
  serializeSettingsBackup,
} from "@ext/core/lib/settings-transfer.ts";
import { getInstalledVersion } from "@ext/core/lib/version.ts";
import { clearRecentUrlKeys } from "@ext/core/background/runtime-state.ts";
import {
  handleWalmartUiMessage,
} from "@ext/domains/walmart/background/handlers/index.ts";
import {
  handleSamsclubUiMessage,
} from "@ext/domains/samsclub/background/handlers/index.ts";
import {
  stopSamsclubTabAuto,
} from "@ext/domains/samsclub/background/automation-runtime-state.ts";
import { startSamsclubTabAuto } from "@ext/domains/samsclub/background/scheduled-auto.ts";
import { stopScheduledSamsclubAuto } from "@ext/domains/samsclub/background/scheduled-auto.ts";
import {
  mergeRetailerScheduleSettings,
  mergeSamsclubScheduleSettings,
  mergeWalmartScheduleSettings,
} from "@ext/core/lib/schedule-settings.ts";
import {
  handleSetWalmartAutoRefreshEnabled,
  handleSetWalmartRefreshInterval,
} from "@ext/domains/walmart/background/handlers/auto-refresh.ts";
import {
  stopScheduledWalmartRefresh,
} from "@ext/domains/walmart/background/scheduled-refresh.ts";
import type { BackgroundResponse, ExtensionSettings, UiToBackground } from "@ext/core/types/index.ts";

function preserveExistingCheckoutCvv(
  previous: ExtensionSettings,
  incoming: ExtensionSettings,
): ExtensionSettings {
  if (
    incoming.samsclub_checkout_cvv === undefined &&
    previous.samsclub_checkout_cvv !== undefined
  ) {
    return { ...incoming, samsclub_checkout_cvv: previous.samsclub_checkout_cvv };
  }
  return incoming;
}

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
      const [settings, settings_import_revision] = await Promise.all([
        getSettings(),
        getSettingsImportRevision(),
      ]);
      const { samsclub_checkout_cvv: _cvv, ...safeSettings } = settings;
      return { ok: true, settings: safeSettings, settings_import_revision };
    }
    case "SAVE_SETTINGS": {
      try {
        if (message.expected_import_revision !== undefined) {
          const currentImportRevision = await getSettingsImportRevision();
          if (currentImportRevision !== message.expected_import_revision) {
            return {
              ok: false,
              error: "Settings were imported while this edit was pending. Retry the change.",
            };
          }
        }
        const previous = await getSettings();
        const next = preserveExistingCheckoutCvv(previous, message.settings);
        await saveSettings(next);
        const sideEffects = await applySettingsReplacementSideEffects(previous, next);
        if (sideEffects.runtimeSyncFailed) {
          return {
            ok: true,
            warning: "Settings saved, but runtime sync failed. Reload the extension.",
          };
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
    case "SET_RETAILER_PRICE_GATE_ENABLED": {
      try {
        await setRetailerPriceGateEnabledForSettings(message.enabled);
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
        return { ok: false, error: "CVV must be 3 or 4 digits" };
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
    case "SET_WALMART_SCHEDULE": {
      try {
        const settings = await getSettings();
        const next = mergeWalmartScheduleSettings(settings, message);
        await saveSettings(next);
        if (message.enabled === false) {
          await stopScheduledWalmartRefresh();
          await resetScheduleRuntimeForRetailer("walmart");
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
    case "EXPORT_SETTINGS_BLOB": {
      try {
        const bundle = await loadSettingsBackupBundle();
        const settings_blob = serializeSettingsBackup(bundle, {
          exportedAt: new Date().toISOString(),
          extensionVersion: getInstalledVersion(),
        });
        return {
          ok: true,
          settings_blob,
          contains_cvv: backupContainsCvv(bundle),
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Export failed",
        };
      }
    }
    case "VALIDATE_SETTINGS_BLOB": {
      try {
        const bundle = parseSettingsBackupBlob(message.blob);
        return { ok: true, import_summary: buildImportSummary(bundle) };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Invalid backup",
        };
      }
    }
    case "IMPORT_SETTINGS_BLOB": {
      try {
        const bundle = parseSettingsBackupBlob(message.blob);
        const previous = await getSettings();
        await saveSettingsBackupBundle(bundle);
        const sideEffects = await applySettingsReplacementSideEffects(previous, bundle.settings);
        if (sideEffects.runtimeSyncFailed) {
          return {
            ok: true,
            warning: "Settings imported, but runtime sync failed. Reload the extension.",
          };
        }
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Import failed",
        };
      }
    }
  }
}
