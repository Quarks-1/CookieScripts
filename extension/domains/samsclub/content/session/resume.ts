import { samsclubCheckoutDebug } from "@ext/domains/samsclub/lib/checkout/debug-log.ts";
import {
  isSamsclubAutoUserStopped,
  markSamsclubAutoUserStopped,
  clearCheckoutNavigationGrace,
  shouldResumeSamsclubAuto,
  shouldResumeSamsclubCheckout,
} from "@ext/domains/samsclub/lib/auto-resume.ts";
import { isOrderConfirmationUrl, readySamsclubAutoModeMessage } from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import { isSamsclubProductUrl } from "@ext/domains/samsclub/lib/host.ts";
import { runAutoMode } from "@ext/domains/samsclub/content/session/auto-mode.ts";
import { completeCheckoutSuccess } from "@ext/domains/samsclub/content/session/checkout-abandon.ts";
import { scheduleCheckoutAutoModeRun } from "@ext/domains/samsclub/content/session/checkout-schedule.ts";
import {
  getTabAutoStateFromBackground,
  publishUiState,
} from "@ext/domains/samsclub/content/session/messaging.ts";
import { scheduleAutomationRun } from "@ext/domains/samsclub/content/session/schedule.ts";
import {
  stopTransitThrottleWatch,
  syncTransitThrottleWatch,
} from "@ext/domains/samsclub/content/session/transit-wait.ts";
import { session, state } from "@ext/domains/samsclub/content/session/session-state.ts";

export { scheduleAutomationRun } from "@ext/domains/samsclub/content/session/schedule.ts";
export { scheduleCheckoutAutoModeRun } from "@ext/domains/samsclub/content/session/checkout-schedule.ts";

export function scheduleAutoModeRun(): void {
  scheduleAutomationRun(runAutoMode);
}

export function tryResumeAutomation(): void {
  if (isSamsclubAutoUserStopped()) {
    return;
  }

  const checkoutResume = shouldResumeSamsclubCheckout(location.href);
  if (checkoutResume) {
    session.channelId = checkoutResume.channel_id;
    session.url = location.href;

    if (isOrderConfirmationUrl(location.href)) {
      void completeCheckoutSuccess();
      return;
    }

    samsclubCheckoutDebug("resume", "schedule checkout automation", {
      url: location.href,
      autoCheckoutEnabled: checkoutResume.auto_checkout_enabled,
    });

    clearCheckoutNavigationGrace();
    stopTransitThrottleWatch();
    publishUiState(
      checkoutResume.auto_checkout_enabled ? "Resuming checkout…" : "Arrived at checkout…",
      checkoutResume.auto_checkout_enabled,
    );
    scheduleCheckoutAutoModeRun();
    return;
  }

  const pdpResume = shouldResumeSamsclubAuto(location.href);
  if (!pdpResume || !isSamsclubProductUrl(location.href)) {
    return;
  }

  session.channelId = pdpResume.channel_id;
  session.url = location.href;
  publishUiState("Resuming auto mode…", true);
  scheduleAutoModeRun();
}

export async function initSamsclubSession(): Promise<void> {
  const tabState = await getTabAutoStateFromBackground();
  if (tabState.manualAutoStopped) {
    markSamsclubAutoUserStopped();
    publishUiState("Stopped", false);
    return;
  }

  if (shouldResumeSamsclubCheckout(location.href) || shouldResumeSamsclubAuto(location.href)) {
    tryResumeAutomation();
    return;
  }

  if (tabState.running) {
    return;
  }

  if (isSamsclubAutoUserStopped()) {
    publishUiState("Stopped", false);
  } else if (!state.automationScheduled && !session.running) {
    publishUiState(readySamsclubAutoModeMessage(location.href), false);
  }

  syncTransitThrottleWatch(() => state.cachedRefreshIntervalSec);
}
