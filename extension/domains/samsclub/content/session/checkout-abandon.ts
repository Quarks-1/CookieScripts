import {
  publishUiState,
  reportAutoStatus,
} from "@ext/domains/samsclub/content/session/messaging.ts";
import { session, state } from "@ext/domains/samsclub/content/session/session-state.ts";
import {
  clearSamsclubAutoResume,
  clearCheckoutNavigationGrace,
  isWithinCheckoutNavigationGrace,
  readSamsclubAutoResume,
} from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  isCheckoutAutomationUrl,
  isCheckoutHandoffTransitUrl,
} from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";

function shouldHoldCheckoutResume(pageUrl: string): boolean {
  return (
    isCheckoutAutomationUrl(pageUrl) ||
    isCheckoutHandoffTransitUrl(pageUrl) ||
    isWithinCheckoutNavigationGrace()
  );
}

export async function completeCheckoutSuccess(): Promise<void> {
  publishUiState("Success", false);
  clearSamsclubAutoResume();
  await reportAutoStatus("success");
}

/** Checkout mode off: ATC + navigate succeeded; stop at review-order. */
export async function completeCheckoutHandoff(): Promise<void> {
  publishUiState("Success — at checkout", false);
  clearSamsclubAutoResume();
  await reportAutoStatus("success");
}

async function handleCheckoutAbandoned(): Promise<void> {
  publishUiState("Left checkout", false);
  clearSamsclubAutoResume();
  await reportAutoStatus("failed", "Left checkout");
  session.running = false;
}

export function maybeFailCheckoutAbandon(): void {
  const resume = readSamsclubAutoResume();
  if (!resume || resume.phase !== "checkout" || !resume.auto_checkout_enabled) {
    state.checkoutAbandonHandled = false;
    return;
  }
  if (shouldHoldCheckoutResume(location.href)) {
    state.checkoutAbandonHandled = false;
    if (isCheckoutAutomationUrl(location.href)) {
      clearCheckoutNavigationGrace();
    }
    return;
  }
  if (state.checkoutAbandonHandled) {
    return;
  }
  state.checkoutAbandonHandled = true;
  void handleCheckoutAbandoned();
}
