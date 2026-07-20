import {
  clearSamsclubManualAutoStopped,
  getSamsclubTabChannel,
  getSamsclubTabUiState,
  isSamsclubManualAutoStopped,
  markSamsclubManualAutoStopped,
  setSamsclubTabPurchaseLimit,
  setSamsclubTabUiState,
} from "@ext/domains/samsclub/background/automation-runtime-state.ts";
import { getSamsclubAtcQuantity, getSamsclubBackendAtcEnabled, getSamsclubCheckoutCvv, getSamsclubFrontendAtcEnabled, getSamsclubRefreshIntervalSec, getSamsclubUseMaxQuantity, shouldEnableSamsclubAutoCheckout } from "@ext/domains/samsclub/lib/channel-config.ts";
import { setSamsclubRefreshIntervalForChannel } from "@ext/core/background/status.ts";
import { getSettings, prependHistory } from "@ext/core/lib/storage.ts";
import type { BackgroundResponse, SamsclubToBackground } from "@ext/core/types/index.ts";

export async function handleSamsclubAutomationMessage(
  message: SamsclubToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab!.id!;

  switch (message.type) {
    case "SAMSCLUB_PING":
      return { ok: true };
    case "SAMSCLUB_GET_TAB_AUTO_STATE": {
      const ui = getSamsclubTabUiState(tabId);
      return {
        ok: true,
        manual_auto_stopped: isSamsclubManualAutoStopped(tabId),
        ui_status: ui.status,
        ui_running: ui.running,
      };
    }
    case "SAMSCLUB_SYNC_MANUAL_STOP":
      markSamsclubManualAutoStopped(tabId);
      return { ok: true };
    case "SAMSCLUB_SYNC_MANUAL_START":
      clearSamsclubManualAutoStopped(tabId);
      return { ok: true };
    case "SAMSCLUB_GET_AUTO_CONFIG": {
      const settings = await getSettings();
      return {
        ok: true,
        refresh_interval_sec: getSamsclubRefreshIntervalSec(settings),
        frontend_atc_enabled: getSamsclubFrontendAtcEnabled(settings),
        backend_atc_enabled: getSamsclubBackendAtcEnabled(settings),
        atc_quantity: getSamsclubAtcQuantity(settings),
        use_max_quantity: getSamsclubUseMaxQuantity(settings),
        auto_checkout_enabled: shouldEnableSamsclubAutoCheckout(settings),
        checkout_cvv: getSamsclubCheckoutCvv(settings),
      };
    }
    case "SAMSCLUB_SET_REFRESH_INTERVAL": {
      const channelId = getSamsclubTabChannel(tabId) ?? message.channel_id;
      await setSamsclubRefreshIntervalForChannel(channelId, message.interval_sec);
      return { ok: true };
    }
    case "SAMSCLUB_HARD_RELOAD": {
      await chrome.tabs.reload(tabId, { bypassCache: true });
      return { ok: true };
    }
    case "SAMSCLUB_AUTO_STATUS": {
      if (message.channel_id !== "manual") {
        const boundChannel = getSamsclubTabChannel(tabId);
        if (!boundChannel || boundChannel !== message.channel_id) {
          return { ok: false, error: "Invalid channel binding" };
        }
      }

      const now = new Date().toISOString();
      await prependHistory([
        {
          kind:
            message.status === "success" ? "samsclub_auto_success" : "samsclub_auto_failed",
          url: message.url,
          author: "samsclub-auto",
          channel_id: message.channel_id,
          timestamp: now,
          error: message.error,
        },
      ]);

      return { ok: true };
    }
    case "SAMSCLUB_UI_STATE": {
      if (isSamsclubManualAutoStopped(tabId) && message.running) {
        return { ok: true };
      }
      setSamsclubTabUiState(tabId, {
        status: message.status,
        running: message.running,
      });
      return { ok: true };
    }
    case "SAMSCLUB_PURCHASE_LIMIT_SNAPSHOT": {
      const tabUrl = sender.tab?.url;
      if (!tabUrl) {
        return { ok: false, error: "Missing tab URL" };
      }
      const limit = message.purchase_limit;
      if (limit != null && (!Number.isFinite(limit) || limit < 1)) {
        setSamsclubTabPurchaseLimit(tabId, tabUrl, null);
        return { ok: true };
      }
      setSamsclubTabPurchaseLimit(
        tabId,
        tabUrl,
        limit == null ? null : Math.floor(limit),
      );
      return { ok: true };
    }
  }

  return { ok: false, error: "Unknown message" };
}
