import { resolveCheckoutState } from "@ext/lib/retailer/checkout/checkout-state.ts";
import { isOrderConfirmationUrl } from "@ext/lib/retailer/checkout/checkout-url.ts";
import {
  clickPlaceOrderOnce,
  createPlaceOrderClickState,
  type PlaceOrderClickState,
} from "@ext/lib/retailer/checkout/place-order.ts";
import { runCheckoutStepTick } from "@ext/lib/retailer/checkout/steps.ts";
import {
  readCheckoutProgressSnapshot,
  runCheckoutWaitingTick,
} from "@ext/lib/retailer/checkout/waiting-checkout.ts";
import { sleep } from "@ext/lib/sleep.ts";

/** Tight poll while checkout DOM is settling; full reload resets the content script. */
export const CHECKOUT_LOOP_SLEEP_MS = 10;

export type RetailerAutoConfig = {
  refreshIntervalSec: number;
  frontendAtcEnabled: boolean;
  backendAtcEnabled: boolean;
  atcQuantity: number;
  useMaxQuantity: boolean;
  autoCheckoutEnabled: boolean;
};

export type CheckoutAutoRunOutcome =
  | "success"
  | "stopped"
  | "failed"
  | "reloading"
  | "checkout_disabled"
  | "auth_required"
  | "abandoned";

export type RunCheckoutAutoModeOptions = {
  shouldContinue: () => boolean;
  isStopRequested: () => boolean;
  getAutoCheckoutEnabled: () => boolean;
  getRefreshIntervalSec: () => number;
  publishUiState: (status: string, running?: boolean) => void;
  requestHardReload: () => Promise<void>;
  onSuccess: () => Promise<void>;
  onFailed: (error: string) => Promise<void>;
  onStopped: () => Promise<void>;
};

export async function finishCheckoutIfConfirmed(
  pageUrl: string,
  onSuccess: () => Promise<void>,
): Promise<boolean> {
  if (!isOrderConfirmationUrl(pageUrl)) {
    return false;
  }
  await onSuccess();
  return true;
}

export async function runCheckoutAutoMode(
  options: RunCheckoutAutoModeOptions,
): Promise<CheckoutAutoRunOutcome> {
  if (await finishCheckoutIfConfirmed(location.href, options.onSuccess)) {
    return "success";
  }

  let progressSnapshot = readCheckoutProgressSnapshot(document);
  const checkoutEnteredAtMs = Date.now();
  const placeOrderState: PlaceOrderClickState = createPlaceOrderClickState();

  while (options.shouldContinue()) {
    if (!options.getAutoCheckoutEnabled()) {
      await options.onStopped();
      return "checkout_disabled";
    }

    if (await finishCheckoutIfConfirmed(location.href, options.onSuccess)) {
      return "success";
    }

    const waitResult = await runCheckoutWaitingTick({
      refreshIntervalSec: options.getRefreshIntervalSec(),
      shouldContinue: options.shouldContinue,
      onStatus: (text) => options.publishUiState(text, true),
      requestHardReload: options.requestHardReload,
      progressSnapshot,
      checkoutEnteredAtMs,
    });

    if (waitResult.kind === "reloading") {
      return "reloading";
    }

    if (waitResult.kind === "auth_required") {
      await options.onFailed("Sign in required");
      return "auth_required";
    }

    if (waitResult.kind === "aborted") {
      if (options.isStopRequested()) {
        await options.onStopped();
        return "stopped";
      }
      return "failed";
    }

    progressSnapshot = waitResult.progressSnapshot;
    const checkoutState = resolveCheckoutState(location.href, document);

    if (checkoutState === "mid_step") {
      options.publishUiState("Advancing checkout…", true);
      runCheckoutStepTick(document);
    } else if (checkoutState === "ready_to_place") {
      if (placeOrderState.clicked) {
        options.publishUiState("Waiting for order confirmation…", true);
      } else if (clickPlaceOrderOnce(placeOrderState, document)) {
        options.publishUiState("Placing order…", true);
      } else {
        options.publishUiState("Waiting for Place order…", true);
      }
    } else {
      options.publishUiState("Waiting for checkout…", true);
    }

    await sleep(CHECKOUT_LOOP_SLEEP_MS);
  }

  if (options.isStopRequested()) {
    await options.onStopped();
    return "stopped";
  }

  return "failed";
}
