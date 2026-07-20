import {
  markCheckoutProgress,
  readSamsclubAutoResume,
  type SamsclubAutoResume,
} from "@ext/domains/samsclub/lib/auto-resume.ts";
import { samsclubCheckoutDebug } from "@ext/domains/samsclub/lib/checkout/debug-log.ts";
import {
  isCheckoutAuthRequiredPage,
  isCheckoutHardErrorPage,
  isCheckoutPageLoading,
} from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import {
  countSaveAndContinueButtons,
  isCheckoutShellLoaded,
  isPlaceOrderEnabled,
  readActiveStepHeading,
} from "@ext/domains/samsclub/lib/checkout/checkout-state.ts";
import { maybeHardRefreshWhileWaiting } from "@ext/domains/samsclub/lib/page-refresh.ts";

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
  /** Wait longer before hard-refreshing a skeleton/spinner checkout load. */
  checkoutLoadingGraceMs?: number;
};

export type CheckoutWaitingTickResult =
  | { kind: "continue"; progressSnapshot: CheckoutProgressSnapshot }
  | { kind: "reloading"; progressSnapshot: CheckoutProgressSnapshot }
  | { kind: "aborted"; progressSnapshot: CheckoutProgressSnapshot }
  | { kind: "auth_required"; progressSnapshot: CheckoutProgressSnapshot };

export function shouldRefreshForCheckoutStall(
  resume: SamsclubAutoResume,
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
  const checkoutLoadingGraceMs = options.checkoutLoadingGraceMs ?? 15_000;
  const pastHydration = Date.now() - options.checkoutEnteredAtMs >= hydrationGraceMs;
  const pageLoading = isCheckoutPageLoading(doc);
  const pastLoadingGrace = Date.now() - options.checkoutEnteredAtMs >= checkoutLoadingGraceMs;

  if (pastHydration && isCheckoutAuthRequiredPage(doc)) {
    return { kind: "auth_required", progressSnapshot: snapshot };
  }

  const hardError = pastHydration && isCheckoutHardErrorPage(doc);
  const loadingStall = pageLoading && pastLoadingGrace;
  const resume = readSamsclubAutoResume();
  const stall =
    resume !== null && shouldRefreshForCheckoutStall(resume, options.refreshIntervalSec);

  if ((hardError || stall || loadingStall) && options.refreshIntervalSec > 0) {
    if (hardError) {
      options.onStatus?.("Checkout error — hard refreshing…");
    } else if (loadingStall) {
      options.onStatus?.("Checkout load stalled — hard refreshing…");
    } else {
      options.onStatus?.("Checkout stalled — hard refreshing…");
    }

    samsclubCheckoutDebug("waiting-checkout", "requesting hard refresh", {
      hardError,
      loadingStall,
      stall,
      pageLoading,
      pastLoadingGrace,
      refreshIntervalSec: options.refreshIntervalSec,
      shellLoaded: current.shellLoaded,
      placeOrderEnabled: current.placeOrderEnabled,
    });

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
  } else if (pageLoading) {
    options.onStatus?.("Waiting for checkout to load…");
  }

  return { kind: "continue", progressSnapshot: snapshot };
}
