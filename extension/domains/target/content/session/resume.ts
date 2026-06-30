import {
  isRetailerAutoUserStopped,
  markRetailerAutoUserStopped,
  shouldResumeRetailerAuto,
  shouldResumeRetailerCheckout,
} from "@ext/domains/target/lib/auto-resume.ts";
import { isOrderConfirmationUrl } from "@ext/domains/target/lib/checkout/checkout-url.ts";
import { isRetailerProductUrl } from "@ext/domains/target/lib/host.ts";
import { runAutoMode } from "@ext/domains/target/content/session/auto-mode.ts";
import { completeCheckoutSuccess } from "@ext/domains/target/content/session/checkout-abandon.ts";
import { runCheckoutAutoMode } from "@ext/domains/target/content/session/checkout-bridge.ts";
import {
  getTabAutoStateFromBackground,
  publishUiState,
} from "@ext/domains/target/content/session/messaging.ts";
import { scheduleAutomationRun } from "@ext/domains/target/content/session/schedule.ts";
import { session, state } from "@ext/domains/target/content/session/session-state.ts";

export { scheduleAutomationRun } from "@ext/domains/target/content/session/schedule.ts";

export function scheduleCheckoutAutoModeRun(): void {
  scheduleAutomationRun(runCheckoutAutoMode);
}

export function scheduleAutoModeRun(): void {
  scheduleAutomationRun(runAutoMode);
}

export function tryResumeAutomation(): void {
  if (isRetailerAutoUserStopped()) {
    return;
  }

  const checkoutResume = shouldResumeRetailerCheckout(location.href);
  if (checkoutResume) {
    session.channelId = checkoutResume.channel_id;
    session.url = location.href;

    if (isOrderConfirmationUrl(location.href)) {
      void completeCheckoutSuccess();
      return;
    }

    publishUiState("Resuming checkout…", true);
    scheduleCheckoutAutoModeRun();
    return;
  }

  const pdpResume = shouldResumeRetailerAuto(location.href);
  if (!pdpResume || !isRetailerProductUrl(location.href)) {
    return;
  }

  session.channelId = pdpResume.channel_id;
  session.url = location.href;
  publishUiState("Resuming auto mode…", true);
  scheduleAutoModeRun();
}

export async function initRetailerSession(): Promise<void> {
  const tabState = await getTabAutoStateFromBackground();
  if (tabState.manualAutoStopped) {
    markRetailerAutoUserStopped();
    publishUiState("Stopped", false);
    return;
  }

  if (shouldResumeRetailerCheckout(location.href) || shouldResumeRetailerAuto(location.href)) {
    tryResumeAutomation();
    return;
  }

  if (tabState.running) {
    return;
  }

  if (isRetailerAutoUserStopped()) {
    publishUiState("Stopped", false);
  } else if (!state.automationScheduled && !session.running) {
    publishUiState(
      isRetailerProductUrl(location.href)
        ? "Ready — press Start Auto Mode"
        : "Ready — open a product page and press Start",
      false,
    );
  }
}
