import { getChannelDomains } from "@ext/core/lib/channel-targets.ts";
import {
  buildStatus,
  setRetailerAtcModesForSettings,
  setRetailerAtcQuantityForSettings,
  setRetailerAutoAtcEnabledForChannel,
  setRetailerAutoCheckoutEnabledForSettings,
  setRetailerRefreshIntervalForChannel,
} from "@ext/core/background/status.ts";
import { getActiveRetailerTabInWindow } from "@ext/domains/target/background/tab-message.ts";
import { getActiveTabInWindow } from "@ext/core/background/window-active-tab.ts";
import {
  bindRetailerTab,
  broadcastRetailerStopAuto,
  clearRetailerManualAutoStopped,
  setRetailerTabUiState,
  stopRetailerTabAuto,
} from "@ext/domains/target/background/runtime-state.ts";
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
      return { ok: true, settings };
    }
    case "SAVE_SETTINGS": {
      try {
        const previous = await getSettings();
        await saveSettings(message.settings);
        if (previous.enabled && !message.settings.enabled) {
          await stopAllWalmartRecordingsForDisable();
          await stopAllWalmartAutoRefreshForDisable();
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_RETAILER_AUTO_ATC_ENABLED": {
      try {
        const settings = await getSettings();
        const domains = getChannelDomains(settings, message.channel_id);
        if (domains.length === 0) {
          return { ok: false, error: "Add at least one allowed domain first" };
        }
        await setRetailerAutoAtcEnabledForChannel(message.channel_id, message.enabled);
        if (!message.enabled) {
          await broadcastRetailerStopAuto(message.channel_id);
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
    case "SET_RETAILER_AUTO_CHECKOUT_ENABLED": {
      try {
        await setRetailerAutoCheckoutEnabledForSettings(message.enabled);
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
      bindRetailerTab(tab.id, "manual");
      clearRetailerManualAutoStopped(tab.id);
      setRetailerTabUiState(tab.id, { status: "Starting auto mode…", running: true });
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "RETAILER_START_MANUAL_AUTO" });
      } catch {
        return {
          ok: false,
          error: "Target tab is not ready — refresh the page",
        };
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
  }
}
