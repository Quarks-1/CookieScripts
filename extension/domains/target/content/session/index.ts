import { hookSpaNavigation } from "@ext/core/lib/spa-navigation.ts";
import { isExtensionContextValid } from "@ext/core/lib/messages.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";
import {
  shouldResumeRetailerCheckout,
} from "@ext/domains/target/lib/auto-resume.ts";
import { isRetailerProductUrl } from "@ext/domains/target/lib/host.ts";
import { takePendingStartAuto } from "@ext/domains/target/lib/pending-start-auto.ts";
import { readPurchaseLimitForStatus } from "@ext/domains/target/lib/quantity-limit.ts";
import {
  handleStartAuto,
  handleStartManualAuto,
  loadAutoConfig,
  requestStopAutoMode,
  syncCartProbeBridge,
} from "@ext/domains/target/content/session/auto-mode.ts";
import { endSession } from "@ext/domains/target/content/session/lifecycle.ts";
import { publishUiState } from "@ext/domains/target/content/session/messaging.ts";
import {
  armPurchaseLimitWatch,
  handleRetailerNavigation,
  hookPurchaseLimitPageShow,
  schedulePurchaseLimitSnapshots,
} from "@ext/domains/target/content/session/purchase-limit.ts";
import { initRetailerSession } from "@ext/domains/target/content/session/resume.ts";
import {
  applyCachedAutoConfig,
  state,
} from "@ext/domains/target/content/session/session-state.ts";
import { watchSettings } from "@ext/domains/target/content/session/settings-watch.ts";

declare global {
  interface Window {
    __cookiescriptsRetailerSessionReady?: boolean;
  }
}

export function startRetailerSession(): void {
  if (!isExtensionContextValid()) {
    return;
  }

  if (isRetailerProductUrl(location.href)) {
    void loadAutoConfig("manual").then((config) => {
      applyCachedAutoConfig(config);
      syncCartProbeBridge();
    });
  } else {
    const checkoutResume = shouldResumeRetailerCheckout(location.href);
    if (checkoutResume) {
      void loadAutoConfig(checkoutResume.channel_id).then((config) => {
        applyCachedAutoConfig(config);
      });
    }
  }

  watchSettings();

  state.unhookRetailerNavigation = hookSpaNavigation(handleRetailerNavigation);
  hookPurchaseLimitPageShow();

  if (isRetailerProductUrl(location.href)) {
    schedulePurchaseLimitSnapshots();
    armPurchaseLimitWatch();
  }

  chrome.runtime.onMessage.addListener((message: BackgroundToContent) => {
    if (!isExtensionContextValid()) {
      endSession();
      return;
    }

    switch (message.type) {
      case "RETAILER_PING":
        return { ok: true };
      case "RETAILER_START_AUTO":
        handleStartAuto(message);
        return { ok: true };
      case "RETAILER_START_MANUAL_AUTO":
        handleStartManualAuto();
        return { ok: true };
      case "RETAILER_STOP_AUTO":
        requestStopAutoMode();
        publishUiState("Stopped", false);
        return { ok: true };
      case "RETAILER_GET_PURCHASE_LIMIT": {
        const purchaseLimit = readPurchaseLimitForStatus(document);
        return {
          ok: true as const,
          purchase_limit: purchaseLimit,
        };
      }
      default:
        return undefined;
    }
  });

  window.__cookiescriptsRetailerSessionReady = true;

  const pendingStartAuto = takePendingStartAuto();
  if (pendingStartAuto) {
    handleStartAuto(pendingStartAuto);
  }

  void initRetailerSession();
}
