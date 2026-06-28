import { buildStatus, setRetailerAutoEnabledForChannel, setRetailerRefreshIntervalForChannel } from "@ext/background/status.ts";
import { broadcastRetailerStopAuto } from "@ext/background/retailer-runtime-state.ts";
import {
  clearHistory,
  clearRetailerProfile,
  getHistory,
  getSettings,
  saveSettings,
} from "@ext/lib/storage.ts";
import { clearRecentUrlKeys } from "@ext/background/runtime-state.ts";
import type { BackgroundResponse, UiToBackground } from "@ext/types/index.ts";

export async function handleUiMessage(
  message: UiToBackground,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  void sender;

  switch (message.type) {
    case "GET_STATUS": {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const status = await buildStatus(activeTab);
      return { ok: true, status };
    }
    case "GET_SETTINGS": {
      const settings = await getSettings();
      return { ok: true, settings };
    }
    case "SAVE_SETTINGS": {
      try {
        await saveSettings(message.settings);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "SET_RETAILER_AUTO_ENABLED": {
      try {
        await setRetailerAutoEnabledForChannel(message.channel_id, message.enabled);
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
    case "CLEAR_RETAILER_PROFILE": {
      await clearRetailerProfile();
      return { ok: true };
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
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
    case "RETAILER_ARM_UI": {
      try {
        await chrome.tabs.sendMessage(message.tab_id, { type: "RETAILER_ARM_UI" });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to arm retailer UI",
        };
      }
    }
  }
}
