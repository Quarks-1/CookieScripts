import { isOrderConfirmationUrl } from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import { resolveCheckoutState } from "@ext/domains/samsclub/lib/checkout/checkout-state.ts";
import { samsclubCheckoutDebug } from "@ext/domains/samsclub/lib/checkout/debug-log.ts";
import {
  canSafelyPlaceOrder,
  hasCheckoutCvvValidationError,
  hasCheckoutFormErrors,
  isCheckoutCvvPromptVisible,
  isCheckoutCvvRequired,
  isCheckoutCvvSatisfied,
  isValidCheckoutCvvLength,
  nudgeCheckoutCvvValidation,
  probeCheckoutCvvCandidates,
  readCheckoutCvvValue,
  tryFillCheckoutCvv,
  waitForPostCvvCheckoutReady,
} from "@ext/domains/samsclub/lib/checkout/cvv.ts";
import { markCheckoutProgress } from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  clickPlaceOrderOnce,
  createPlaceOrderClickState,
  resetPlaceOrderClickState,
  type PlaceOrderClickState,
} from "@ext/domains/samsclub/lib/checkout/place-order.ts";
import { runCheckoutStepTick } from "@ext/domains/samsclub/lib/checkout/steps.ts";
import {
  readCheckoutProgressSnapshot,
  runCheckoutWaitingTick,
} from "@ext/domains/samsclub/lib/checkout/waiting-checkout.ts";
import { sleep } from "@ext/core/lib/sleep.ts";

/** Tight poll while checkout DOM is settling; full reload resets the content script. */
export const CHECKOUT_LOOP_SLEEP_MS = 10;
const CHECKOUT_DEBUG_HEARTBEAT_MS = 2_000;

export type SamsclubAutoConfig = {
  refreshIntervalSec: number;
  frontendAtcEnabled: boolean;
  backendAtcEnabled: boolean;
  atcQuantity: number;
  useMaxQuantity: boolean;
  autoCheckoutEnabled: boolean;
  checkoutCvv: string | null;
  stopOnOosEnabled: boolean;
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
  getCheckoutCvv: () => string | null;
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

  // Fresh stall timer on each checkout page load (hard reload resumes here).
  markCheckoutProgress();

  let progressSnapshot = readCheckoutProgressSnapshot(document);
  const checkoutEnteredAtMs = Date.now();
  const placeOrderState: PlaceOrderClickState = createPlaceOrderClickState();
  let cvvGatePassed = false;
  let lastHeartbeatMs = 0;
  let loopTicks = 0;

  samsclubCheckoutDebug("checkout-auto", "loop started", {
    url: location.href,
    refreshIntervalSec: options.getRefreshIntervalSec(),
    autoCheckoutEnabled: options.getAutoCheckoutEnabled(),
    hasCheckoutCvv: options.getCheckoutCvv() != null,
    shellLoaded: progressSnapshot.shellLoaded,
    placeOrderEnabled: progressSnapshot.placeOrderEnabled,
    cvvCandidates: probeCheckoutCvvCandidates(document),
  });

  while (options.shouldContinue()) {
    loopTicks += 1;
    if (!options.getAutoCheckoutEnabled()) {
      samsclubCheckoutDebug("checkout-auto", "exit checkout_disabled");
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
      samsclubCheckoutDebug("checkout-auto", "exit reloading");
      return "reloading";
    }

    if (waitResult.kind === "auth_required") {
      samsclubCheckoutDebug("checkout-auto", "exit auth_required");
      await options.onFailed("Sign in required");
      return "auth_required";
    }

    if (waitResult.kind === "aborted") {
      samsclubCheckoutDebug("checkout-auto", "exit aborted", {
        stopRequested: options.isStopRequested(),
      });
      if (options.isStopRequested()) {
        await options.onStopped();
        return "stopped";
      }
      return "failed";
    }

    progressSnapshot = waitResult.progressSnapshot;
    const checkoutState = resolveCheckoutState(location.href, document);
    const nowMs = Date.now();
    if (nowMs - lastHeartbeatMs >= CHECKOUT_DEBUG_HEARTBEAT_MS) {
      lastHeartbeatMs = nowMs;
      samsclubCheckoutDebug("checkout-auto", "heartbeat", {
        ticks: loopTicks,
        checkoutState,
        waitKind: waitResult.kind,
        shellLoaded: progressSnapshot.shellLoaded,
        placeOrderEnabled: progressSnapshot.placeOrderEnabled,
        cvvCandidates: probeCheckoutCvvCandidates(document),
        hasCheckoutCvv: options.getCheckoutCvv() != null,
      });
    }

    if (
      checkoutState === "mid_step" ||
      checkoutState === "ready_to_place" ||
      (checkoutState === "needs_cvv" &&
        isCheckoutCvvSatisfied(document, location.href) &&
        !isCheckoutCvvRequired(document, location.href))
    ) {
      markCheckoutProgress();
    }

    if (checkoutState === "mid_step") {
      options.publishUiState("Advancing checkout…", true);
      runCheckoutStepTick(document);
    } else if (checkoutState === "needs_cvv") {
      cvvGatePassed = false;
      if (placeOrderState.clicked) {
        resetPlaceOrderClickState(placeOrderState);
        samsclubCheckoutDebug("checkout-auto", "reset place order — cvv still required");
      }
      const checkoutCvv = options.getCheckoutCvv();
      if (!checkoutCvv) {
        options.publishUiState("CVV required — set in side panel", true);
      } else if (
        hasCheckoutFormErrors(document) &&
        isValidCheckoutCvvLength(readCheckoutCvvValue(document).length)
      ) {
        options.publishUiState("Waiting for CVV validation…", true);
        await nudgeCheckoutCvvValidation(document);
        cvvGatePassed = await waitForPostCvvCheckoutReady(document, undefined, location.href);
        samsclubCheckoutDebug("checkout-auto", "cvv nudge after form error", {
          cvvGatePassed,
          formErrors: hasCheckoutFormErrors(document),
        });
      } else if (
        isValidCheckoutCvvLength(readCheckoutCvvValue(document).length) &&
        !isCheckoutCvvSatisfied(document, location.href)
      ) {
        options.publishUiState("Waiting for CVV validation…", true);
        await nudgeCheckoutCvvValidation(document);
        cvvGatePassed = await waitForPostCvvCheckoutReady(document, undefined, location.href);
      } else {
        const fillResult = await tryFillCheckoutCvv(checkoutCvv, document, location.href);
        samsclubCheckoutDebug("checkout-auto", "cvv fill attempt", {
          fillResult,
          cvvDomLength: readCheckoutCvvValue(document).length,
          cvvPromptVisible: isCheckoutCvvPromptVisible(document),
          cvvValidationError: hasCheckoutCvvValidationError(document),
          formErrors: hasCheckoutFormErrors(document),
          cvvCandidates: probeCheckoutCvvCandidates(document),
        });
        if (fillResult === "invalid_cvv") {
          options.publishUiState("CVV required — set in side panel", true);
        } else if (fillResult === "missing_field") {
          options.publishUiState("Waiting for CVV field…", true);
        } else if (fillResult === "pending_validation") {
          options.publishUiState("Waiting for CVV validation…", true);
          await nudgeCheckoutCvvValidation(document);
          markCheckoutProgress();
          cvvGatePassed = await waitForPostCvvCheckoutReady(document, undefined, location.href);
        } else {
          options.publishUiState("Waiting for CVV validation…", true);
          if (fillResult === "filled" || fillResult === "already_set") {
            markCheckoutProgress();
          }
          cvvGatePassed = await waitForPostCvvCheckoutReady(document, undefined, location.href);
        }
      }
    } else if (checkoutState === "ready_to_place") {
      if (
        !cvvGatePassed ||
        !canSafelyPlaceOrder(document, location.href) ||
        (isCheckoutCvvPromptVisible(document) && !isCheckoutCvvSatisfied(document, location.href))
      ) {
        cvvGatePassed = false;
        resetPlaceOrderClickState(placeOrderState);
        options.publishUiState(
          hasCheckoutFormErrors(document)
            ? "Checkout error — refilling CVV…"
            : "Waiting for CVV validation…",
          true,
        );
      } else if (placeOrderState.clicked) {
        options.publishUiState("Waiting for order confirmation…", true);
      } else {
        const stillReady = await waitForPostCvvCheckoutReady(
          document,
          2_000,
          location.href,
        );
        if (!stillReady) {
          cvvGatePassed = false;
          options.publishUiState("Waiting for CVV validation…", true);
        } else if (clickPlaceOrderOnce(placeOrderState, document, location.href)) {
          samsclubCheckoutDebug("checkout-auto", "clicked place order");
          options.publishUiState("Placing order…", true);
        } else {
          options.publishUiState("Waiting for Place order…", true);
        }
      }
    } else {
      options.publishUiState(
        progressSnapshot.shellLoaded ? "Waiting for checkout…" : "Waiting for checkout to load…",
        true,
      );
    }

    await sleep(CHECKOUT_LOOP_SLEEP_MS);
  }

  if (options.isStopRequested()) {
    samsclubCheckoutDebug("checkout-auto", "exit stopped");
    await options.onStopped();
    return "stopped";
  }

  samsclubCheckoutDebug("checkout-auto", "exit failed", {
    ticks: loopTicks,
    shouldContinue: options.shouldContinue(),
  });
  return "failed";
}
