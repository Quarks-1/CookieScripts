import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { isExtensionContextValid } from "@ext/core/lib/messages.ts";
import type { ExtensionSettings } from "@ext/core/types/index.ts";
import { getRetailerAutoCheckoutMode } from "@ext/domains/target/lib/channel-config.ts";
import { readRetailerAutoResume } from "@ext/domains/target/lib/auto-resume.ts";
import {
  loadAutoConfig,
  requestStopAutoMode,
  syncCartProbeBridge,
} from "@ext/domains/target/content/session/auto-mode.ts";
import {
  applyCachedAutoConfig,
  session,
} from "@ext/domains/target/content/session/session-state.ts";

export { applyCachedAutoConfig } from "@ext/domains/target/content/session/session-state.ts";

export function isRetailerAutoDisabledInSettings(settings: ExtensionSettings): boolean {
  if (!settings.enabled) {
    return true;
  }
  if (!session.channelId || session.channelId === "manual") {
    return false;
  }
  return settings.retailer_auto_atc_enabled !== true;
}

export function isCheckoutDisabledInSettings(settings: ExtensionSettings): boolean {
  return getRetailerAutoCheckoutMode(settings) === "off";
}

export function watchSettings(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !isExtensionContextValid()) {
      return;
    }
    const settingsChange = changes[STORAGE_KEYS.settings];
    if (settingsChange?.newValue && typeof settingsChange.newValue === "object") {
      const settings = settingsChange.newValue as ExtensionSettings;
      if (session.running) {
        if (isRetailerAutoDisabledInSettings(settings)) {
          requestStopAutoMode();
        } else if (
          readRetailerAutoResume()?.phase === "checkout" &&
          isCheckoutDisabledInSettings(settings)
        ) {
          requestStopAutoMode();
        }
      }
      if (session.channelId) {
        void loadAutoConfig(session.channelId).then((config) => {
          applyCachedAutoConfig(config);
          syncCartProbeBridge();
        });
      }
    }
  });
}
