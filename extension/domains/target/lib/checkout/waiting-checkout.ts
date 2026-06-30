import {
  markCheckoutProgress,
  readRetailerAutoResume,
  type RetailerAutoResume,
} from "@ext/domains/target/lib/auto-resume.ts";
import {
  isCheckoutAuthRequiredPage,
  isCheckoutHardErrorPage,
} from "@ext/domains/target/lib/checkout/checkout-url.ts";
import {
  countSaveAndContinueButtons,
  isCheckoutShellLoaded,
  isPlaceOrderEnabled,
  readActiveStepHeading,
} from "@ext/domains/target/lib/checkout/checkout-state.ts";
import { maybeHardRefreshWhileWaiting } from "@ext/domains/target/lib/page-refresh.ts";

export type CheckoutProgressSnapshot = {
  saveAndContinueCount: number;
  activeStepHeading: string | null;
  placeOrderEnabled: boolean;
  shellLoaded: boolean;
};

export function readCheckoutProgressSnapshot(doc: Document = document): CheckoutProgressSnapshot {
  return {
    saveAndContinueCount: countSaveAndContinueButtons(doc),
    activeStepHeading: readActiveStepHeading(doc),
    placeOrderEnabled: isPlaceOrderEnabled(doc),
    shellLoaded: isCheckoutShellLoaded(doc),
  };
}

export function hasCheckoutProgress(
  previous: CheckoutProgressSnapshot,
  current: CheckoutProgressSnapshot,
): boolean {
  if (!previous.shellLoaded && current.shellLoaded) {
    return true;
  }
  if (current.saveAndContinueCount < previous.saveAndContinueCount) {
    return true;
  }
  if (previous.activeStepHeading !== current.activeStepHeading) {
    return true;
  }
  if (!previous.placeOrderEnabled && current.placeOrderEnabled) {
    return true;
  }
  return false;
}

export type CheckoutWaitingTickOptions = {
  refreshIntervalSec: number;
  shouldContinue: () => boolean;
  onStatus?: (status: string) => void;
  requestHardReload: () => Promise<void>;
  progressSnapshot: CheckoutProgressSnapshot;
  checkoutEnteredAtMs: number;
  hydrationGraceMs?: number;
};

export type CheckoutWaitingTickResult =
  | { kind: "continue"; progressSnapshot: CheckoutProgressSnapshot }
  | { kind: "reloading"; progressSnapshot: CheckoutProgressSnapshot }
  | { kind: "aborted"; progressSnapshot: CheckoutProgressSnapshot }
  | { kind: "auth_required"; progressSnapshot: CheckoutProgressSnapshot };

export function shouldRefreshForCheckoutStall(
  resume: RetailerAutoResume,
  refreshIntervalSec: number,
): boolean {
  if (refreshIntervalSec <= 0) {
    return false;
  }
  const elapsedMs = Date.now() - resume.last_checkout_progress_at;
  return elapsedMs >= refreshIntervalSec * 1000;
}

export async function runCheckoutWaitingTick(
  options: CheckoutWaitingTickOptions,
): Promise<CheckoutWaitingTickResult> {
  const doc = document;
  const current = readCheckoutProgressSnapshot(doc);
  let snapshot = options.progressSnapshot;

  if (hasCheckoutProgress(snapshot, current)) {
    markCheckoutProgress();
    snapshot = current;
  }

  const hydrationGraceMs = options.hydrationGraceMs ?? 3_000;
  const pastHydration = Date.now() - options.checkoutEnteredAtMs >= hydrationGraceMs;

  if (pastHydration && isCheckoutAuthRequiredPage(doc)) {
    return { kind: "auth_required", progressSnapshot: snapshot };
  }

  const hardError = pastHydration && isCheckoutHardErrorPage(doc);
  const resume = readRetailerAutoResume();
  const stall =
    resume !== null && shouldRefreshForCheckoutStall(resume, options.refreshIntervalSec);

  if ((hardError || stall) && options.refreshIntervalSec > 0) {
    if (hardError) {
      options.onStatus?.("Checkout error — hard refreshing…");
    } else {
      options.onStatus?.("Checkout stalled — hard refreshing…");
    }

    const refreshResult = await maybeHardRefreshWhileWaiting({
      refreshIntervalSec: options.refreshIntervalSec,
      shouldContinue: options.shouldContinue,
      onStatus: options.onStatus,
      requestHardReload: options.requestHardReload,
      stallTimestampField: "last_checkout_progress_at",
    });

    if (refreshResult === "reloading") {
      return { kind: "reloading", progressSnapshot: snapshot };
    }
    if (refreshResult === "aborted") {
      return { kind: "aborted", progressSnapshot: snapshot };
    }
  } else if (hardError) {
    options.onStatus?.("Waiting for checkout…");
  }

  return { kind: "continue", progressSnapshot: snapshot };
}
