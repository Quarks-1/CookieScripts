import {
  clearRetailerManualAutoStopped,
  getRetailerTabChannel,
  getRetailerTabUiState,
  isRetailerManualAutoStopped,
  markRetailerManualAutoStopped,
  setRetailerTabPurchaseLimit,
  setRetailerTabUiState,
} from "@ext/domains/target/background/runtime-state.ts";
import { getRetailerAtcQuantity, getRetailerBackendAtcEnabled, getRetailerFrontendAtcEnabled, getRetailerRefreshIntervalSec, getRetailerUseMaxQuantity, shouldEnableRetailerAutoCheckout } from "@ext/domains/target/lib/channel-config.ts";
import { setRetailerRefreshIntervalForChannel } from "@ext/core/background/status.ts";
import { getSettings, prependHistory } from "@ext/core/lib/storage.ts";
import type { BackgroundResponse, RetailerToBackground } from "@ext/core/types/index.ts";

export async function handleRetailerMessage(
  message: RetailerToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab!.id!;

  switch (message.type) {
    case "RETAILER_PING":
      return { ok: true };
    case "RETAILER_GET_TAB_AUTO_STATE": {
      const ui = getRetailerTabUiState(tabId);
      return {
        ok: true,
        manual_auto_stopped: isRetailerManualAutoStopped(tabId),
        ui_status: ui.status,
        ui_running: ui.running,
      };
    }
    case "RETAILER_SYNC_MANUAL_STOP":
      markRetailerManualAutoStopped(tabId);
      return { ok: true };
    case "RETAILER_SYNC_MANUAL_START":
      clearRetailerManualAutoStopped(tabId);
      return { ok: true };
    case "RETAILER_GET_AUTO_CONFIG": {
      const settings = await getSettings();
      return {
        ok: true,
        refresh_interval_sec: getRetailerRefreshIntervalSec(settings, message.channel_id),
        frontend_atc_enabled: getRetailerFrontendAtcEnabled(settings),
        backend_atc_enabled: getRetailerBackendAtcEnabled(settings),
        atc_quantity: getRetailerAtcQuantity(settings),
        use_max_quantity: getRetailerUseMaxQuantity(settings),
        auto_checkout_enabled: shouldEnableRetailerAutoCheckout(settings, {
          openedViaSkuMatch: false,
        }),
      };
    }
    case "RETAILER_SET_REFRESH_INTERVAL": {
      const channelId = getRetailerTabChannel(tabId) ?? message.channel_id;
      await setRetailerRefreshIntervalForChannel(channelId, message.interval_sec);
      return { ok: true };
    }
    case "RETAILER_HARD_RELOAD": {
      await chrome.tabs.reload(tabId, { bypassCache: true });
      return { ok: true };
    }
    case "RETAILER_AUTO_STATUS": {
      if (message.channel_id !== "manual") {
        const boundChannel = getRetailerTabChannel(tabId);
        if (!boundChannel || boundChannel !== message.channel_id) {
          return { ok: false, error: "Invalid channel binding" };
        }
      }

      const now = new Date().toISOString();
      await prependHistory([
        {
          kind:
            message.status === "success" ? "retailer_auto_success" : "retailer_auto_failed",
          url: message.url,
          author: "retailer-auto",
          channel_id: message.channel_id,
          timestamp: now,
          error: message.error,
        },
      ]);

      return { ok: true };
    }
    case "RETAILER_UI_STATE": {
      if (isRetailerManualAutoStopped(tabId) && message.running) {
        return { ok: true };
      }
      setRetailerTabUiState(tabId, {
        status: message.status,
        running: message.running,
      });
      return { ok: true };
    }
    case "RETAILER_PURCHASE_LIMIT_SNAPSHOT": {
      const tabUrl = sender.tab?.url;
      if (!tabUrl) {
        return { ok: false, error: "Missing tab URL" };
      }
      const limit = message.purchase_limit;
      if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
        setRetailerTabPurchaseLimit(tabId, tabUrl, null);
        return { ok: true };
      }
      setRetailerTabPurchaseLimit(
        tabId,
        tabUrl,
        limit == null ? null : Math.floor(limit),
      );
      return { ok: true };
    }
  }
}
