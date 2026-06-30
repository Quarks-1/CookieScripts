import {
  publishUiState,
  reportAutoStatus,
} from "@ext/domains/target/content/session/messaging.ts";
import { session, state } from "@ext/domains/target/content/session/session-state.ts";
import {
  clearRetailerAutoResume,
  readRetailerAutoResume,
} from "@ext/domains/target/lib/auto-resume.ts";
import { isCheckoutAutomationUrl } from "@ext/domains/target/lib/checkout/checkout-url.ts";

export async function completeCheckoutSuccess(): Promise<void> {
  publishUiState("Success", false);
  clearRetailerAutoResume();
  await reportAutoStatus("success");
}

async function handleCheckoutAbandoned(): Promise<void> {
  publishUiState("Left checkout", false);
  clearRetailerAutoResume();
  await reportAutoStatus("failed", "Left checkout");
  session.running = false;
}

export function maybeFailCheckoutAbandon(): void {
  const resume = readRetailerAutoResume();
  if (!resume || resume.phase !== "checkout" || !resume.auto_checkout_enabled) {
    state.checkoutAbandonHandled = false;
    return;
  }
  if (isCheckoutAutomationUrl(location.href)) {
    state.checkoutAbandonHandled = false;
    return;
  }
  if (state.checkoutAbandonHandled) {
    return;
  }
  state.checkoutAbandonHandled = true;
  void handleCheckoutAbandoned();
}
