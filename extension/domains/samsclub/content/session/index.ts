import { hookSpaNavigation } from "@ext/core/lib/spa-navigation.ts";
import { isExtensionContextInvalidatedError, isExtensionContextValid } from "@ext/core/lib/messages.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";
import {
  shouldResumeSamsclubCheckout,
} from "@ext/domains/samsclub/lib/auto-resume.ts";
import { isSamsclubProductUrl } from "@ext/domains/samsclub/lib/host.ts";
import { takePendingStartAuto } from "@ext/domains/samsclub/lib/pending-start-auto.ts";
import { readPurchaseLimitForStatus } from "@ext/domains/samsclub/lib/quantity-limit.ts";
import {
  handleStartAuto,
  handleStartManualAuto,
  loadAutoConfig,
  requestStopAutoMode,
  syncCartProbeBridge,
} from "@ext/domains/samsclub/content/session/auto-mode.ts";
import { endSession } from "@ext/domains/samsclub/content/session/lifecycle.ts";
import { publishUiState } from "@ext/domains/samsclub/content/session/messaging.ts";
import {
  armPurchaseLimitWatch,
  handleSamsclubNavigation,
  hookPurchaseLimitPageShow,
  schedulePurchaseLimitSnapshots,
} from "@ext/domains/samsclub/content/session/purchase-limit.ts";
import { initSamsclubSession } from "@ext/domains/samsclub/content/session/resume.ts";
import {
  applyCachedAutoConfig,
  state,
} from "@ext/domains/samsclub/content/session/session-state.ts";
import { watchSettings } from "@ext/domains/samsclub/content/session/settings-watch.ts";

declare global {
  interface Window {
    __cookiescriptsSamsclubSessionReady?: boolean;
  }
}

export function startSamsclubSession(): void {
  if (!isExtensionContextValid()) {
    return;
  }

  if (isSamsclubProductUrl(location.href)) {
    void loadAutoConfig("manual")
      .then((config) => {
        applyCachedAutoConfig(config);
        syncCartProbeBridge();
      })
      .catch((err) => {
        if (isExtensionContextInvalidatedError(err)) {
          endSession();
        }
      });
  } else {
    const checkoutResume = shouldResumeSamsclubCheckout(location.href);
    if (checkoutResume) {
      void loadAutoConfig(checkoutResume.channel_id)
        .then((config) => {
          applyCachedAutoConfig(config);
        })
        .catch((err) => {
          if (isExtensionContextInvalidatedError(err)) {
            endSession();
          }
        });
    }
  }

  watchSettings();

  state.unhookSamsclubNavigation = hookSpaNavigation(handleSamsclubNavigation);
  hookPurchaseLimitPageShow();

  if (isSamsclubProductUrl(location.href)) {
    schedulePurchaseLimitSnapshots();
    armPurchaseLimitWatch();
  }

  chrome.runtime.onMessage.addListener((message: BackgroundToContent) => {
    if (!isExtensionContextValid()) {
      endSession();
      return;
    }

    switch (message.type) {
      case "SAMSCLUB_PING":
        return { ok: true };
      case "SAMSCLUB_START_AUTO":
        handleStartAuto(message);
        return { ok: true };
      case "SAMSCLUB_START_MANUAL_AUTO":
        handleStartManualAuto(message.hard_refresh === true);
        return { ok: true };
      case "SAMSCLUB_STOP_AUTO":
        requestStopAutoMode();
        publishUiState("Stopped", false);
        return { ok: true };
      case "SAMSCLUB_GET_PURCHASE_LIMIT": {
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

  window.__cookiescriptsSamsclubSessionReady = true;

  const pendingStartAuto = takePendingStartAuto();
  if (pendingStartAuto) {
    handleStartAuto(pendingStartAuto);
  }

  void initSamsclubSession().catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}
