import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { isExtensionContextValid } from "@ext/core/lib/messages.ts";
import type { ExtensionSettings } from "@ext/core/types/index.ts";
import { getSamsclubAutoCheckoutMode } from "@ext/domains/samsclub/lib/channel-config.ts";
import { readSamsclubAutoResume } from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  loadAutoConfig,
  requestStopAutoMode,
  syncCartProbeBridge,
} from "@ext/domains/samsclub/content/session/auto-mode.ts";
import {
  applyCachedAutoConfig,
  session,
} from "@ext/domains/samsclub/content/session/session-state.ts";

export { applyCachedAutoConfig } from "@ext/domains/samsclub/content/session/session-state.ts";

export function isSamsclubAutoDisabledInSettings(settings: ExtensionSettings): boolean {
  return !settings.enabled;
}

export function isCheckoutDisabledInSettings(settings: ExtensionSettings): boolean {
  return getSamsclubAutoCheckoutMode(settings) === "off";
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
        if (isSamsclubAutoDisabledInSettings(settings)) {
          requestStopAutoMode();
        } else if (
          readSamsclubAutoResume()?.phase === "checkout" &&
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
