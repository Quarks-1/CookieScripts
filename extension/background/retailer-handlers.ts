import {
  clearRetailerManualAutoStopped,
  getRetailerTabChannel,
  isRetailerManualAutoStopped,
  markRetailerManualAutoStopped,
  releaseRetailerJob,
  setRetailerTabPurchaseLimit,
  setRetailerTabUiState,
} from "@ext/background/retailer-runtime-state.ts";
import { getRetailerAtcQuantity, getRetailerBackendAtcEnabled, getRetailerFrontendAtcEnabled, getRetailerRefreshIntervalSec, getRetailerUseMaxQuantity } from "@ext/lib/retailer/channel-config.ts";
import { setRetailerRefreshIntervalForChannel } from "@ext/background/status.ts";
import { getSettings, prependHistory } from "@ext/lib/storage.ts";
import type { BackgroundResponse, RetailerToBackground } from "@ext/types/index.ts";

export async function handleRetailerMessage(
  message: RetailerToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const tabId = sender.tab!.id!;

  switch (message.type) {
    case "RETAILER_PING":
      return { ok: true };
    case "RETAILER_GET_TAB_AUTO_STATE":
      return { ok: true, manual_auto_stopped: isRetailerManualAutoStopped(tabId) };
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

      releaseRetailerJob(message.channel_id);
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
