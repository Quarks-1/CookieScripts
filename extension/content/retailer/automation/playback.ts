import {
  dismissCartAddFailureModal,
  hasCartAddFailureUi,
  isCartConfirmed,
  readCartCountFromDocument,
} from "@ext/lib/retailer/cart-step.ts";
import { retryUntilConfirmed } from "@ext/lib/retailer/cart-retry.ts";
import {
  findMainAddToCartButton,
  parseTargetTcinFromUrl,
  resolveMainAddToCartWaitState,
  waitForMainAddToCartButton,
} from "@ext/lib/retailer/main-add-to-cart.ts";
import { runWaitingDisabledTick } from "@ext/lib/retailer/waiting-disabled.ts";
import { maybeHardRefreshWhileWaiting } from "@ext/lib/retailer/page-refresh.ts";
import { readRetailerAutoResume } from "@ext/lib/retailer/auto-resume.ts";
import { activateElement } from "@ext/lib/retailer/dom.ts";
import { runPlaybackEngine } from "@ext/lib/retailer/playback-engine.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/lib/retailer/selectors.ts";
import { sleep } from "@ext/lib/sleep.ts";
import type { AutomationStep } from "@ext/types/retailer.ts";

const OPTIONAL_CLICK_TIMEOUT_MS = 3_000;
const POST_ACTION_DELAY_MS = 600;
const ADD_TO_CART_RETRY_INTERVAL_MS = 10;

export type AutomationPlaybackOptions = {
  shouldContinue: () => boolean;
  refreshIntervalSec: number;
  getRefreshIntervalSec?: () => number;
  requestHardReload: () => Promise<void>;
  frontendAtcEnabled: boolean;
  backendAtcEnabled: boolean;
  cartAlreadyAdded?: boolean;
};

function cartMinDelta(steps: AutomationStep[]): number {
  const waitStep = steps.find((step) => step.type === "wait_for_cart_delta");
  return waitStep?.type === "wait_for_cart_delta" ? waitStep.minDelta : 1;
}

async function performAddToCartClick(element: HTMLElement, holdMs: number): Promise<void> {
  element.focus({ preventScroll: true });

  const down = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
    repeat: true,
  });
  element.dispatchEvent(down);
  await sleep(holdMs);
  element.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
  );

  activateElement(element);
}

async function addToCartUntilConfirmed(
  selectors: string[],
  holdMs: number,
  baselineCount: number,
  minDelta: number,
  options: AutomationPlaybackOptions,
  onStatus: (status: string) => void,
  atcState: { confirmedViaApi: boolean },
): Promise<"confirmed" | "aborted" | "reloading"> {
  const resolvedSelectors = selectors.length ? selectors : DEFAULT_ADD_TO_CART_SELECTORS;
  let attempts = 0;
  let reportedWaiting = false;
  let reloading = false;
  let confirmedViaApi = atcState.confirmedViaApi;
  let lastCartApiProbeMs: number | null = null;
  const pageUrl = location.href;
  const tcin = parseTargetTcinFromUrl(pageUrl);
  const resolveRefreshIntervalSec = () =>
    options.getRefreshIntervalSec?.() ?? options.refreshIntervalSec;

  const result = await retryUntilConfirmed({
    retryIntervalMs: ADD_TO_CART_RETRY_INTERVAL_MS,
    shouldContinue: () => options.shouldContinue() && !reloading,
    isConfirmed: () => confirmedViaApi || isCartConfirmed(document, baselineCount, minDelta),
    tryAction: async () => {
      const refresh = await maybeHardRefreshWhileWaiting({
        refreshIntervalSec: resolveRefreshIntervalSec(),
        shouldContinue: options.shouldContinue,
        onStatus,
        requestHardReload: options.requestHardReload,
      });
      if (refresh === "reloading") {
        reloading = true;
        return;
      }

      if (hasCartAddFailureUi(document)) {
        onStatus("Dismissing add-to-cart error…");
        dismissCartAddFailureModal(document);
        await sleep(POST_ACTION_DELAY_MS);
        return;
      }

      const waitState = resolveMainAddToCartWaitState(resolvedSelectors, pageUrl);
      const shouldPollBackend =
        options.backendAtcEnabled &&
        (waitState.kind === "waiting_disabled" ||
          (waitState.kind === "ready" && !options.frontendAtcEnabled));

      if (shouldPollBackend) {
        const tick = await runWaitingDisabledTick({
          pageUrl,
          tcin,
          backendAtcEnabled: true,
          onStatus,
          shouldContinue: options.shouldContinue,
          refreshIntervalSec: resolveRefreshIntervalSec(),
          getRefreshIntervalSec: options.getRefreshIntervalSec,
          requestHardReload: options.requestHardReload,
          lastCartApiProbeMs,
          reportedWaiting,
        });
        lastCartApiProbeMs = tick.lastCartApiProbeMs;
        reportedWaiting = tick.reportedWaiting;

        if (tick.outcome === "reloading") {
          reloading = true;
        }
        if (tick.outcome === "cart_added") {
          confirmedViaApi = true;
          atcState.confirmedViaApi = true;
        }
        return;
      }

      if (waitState.kind === "waiting_disabled") {
        const tick = await runWaitingDisabledTick({
          pageUrl,
          tcin,
          backendAtcEnabled: false,
          onStatus,
          shouldContinue: options.shouldContinue,
          refreshIntervalSec: resolveRefreshIntervalSec(),
          getRefreshIntervalSec: options.getRefreshIntervalSec,
          requestHardReload: options.requestHardReload,
          lastCartApiProbeMs,
          reportedWaiting,
        });
        lastCartApiProbeMs = tick.lastCartApiProbeMs;
        reportedWaiting = tick.reportedWaiting;

        if (tick.outcome === "reloading") {
          reloading = true;
        }
        return;
      }

      if (!options.frontendAtcEnabled) {
        return;
      }

      const element =
        waitState.kind === "ready"
          ? waitState.element
          : findMainAddToCartButton(resolvedSelectors, {
              pageUrl: location.href,
              requireActionable: true,
            });
      if (!element) {
        return;
      }

      onStatus(attempts === 0 ? "Adding to cart…" : "Retrying add to cart…");
      attempts += 1;
      await performAddToCartClick(element, holdMs);
    },
  });

  if (reloading) {
    return "reloading";
  }

  if (confirmedViaApi) {
    return "confirmed";
  }

  return result;
}

export async function runAutomationPlayback(
  steps: AutomationStep[],
  onStatus: (status: string) => void,
  options: AutomationPlaybackOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const playbackSteps = options.cartAlreadyAdded
    ? steps.filter((step) => step.type === "navigate")
    : steps;

  const baselineCartCount = readCartCountFromDocument(document);
  const minDelta = cartMinDelta(steps);
  const {
    shouldContinue,
    refreshIntervalSec,
    getRefreshIntervalSec,
    requestHardReload,
    frontendAtcEnabled,
    backendAtcEnabled,
  } = options;
  const resolveRefreshIntervalSec = () => getRefreshIntervalSec?.() ?? refreshIntervalSec;
  const atcState = { confirmedViaApi: options.cartAlreadyAdded === true };

  const addResult = await runPlaybackEngine(playbackSteps, {
    click: async (selectors, optional = false) => {
      if (!frontendAtcEnabled) {
        return optional;
      }

      onStatus(optional ? "Checking fulfillment…" : "Clicking…");
      const result = await waitForMainAddToCartButton({
        selectors,
        timeoutMs: optional ? OPTIONAL_CLICK_TIMEOUT_MS : null,
        shouldContinue,
        pageUrl: location.href,
        onStatus,
        refreshIntervalSec: optional ? 0 : resolveRefreshIntervalSec(),
        getRefreshIntervalSec: optional ? undefined : resolveRefreshIntervalSec,
        requestHardReload: optional ? undefined : requestHardReload,
        frontendAtcEnabled,
        backendAtcEnabled,
      });
      if (!result || result.kind === "api_added") {
        return optional;
      }
      activateElement(result.element);
      await sleep(POST_ACTION_DELAY_MS);
      return true;
    },
    keyboardEnterHold: async (selectors, holdMs) => {
      const result = await addToCartUntilConfirmed(
        selectors,
        holdMs,
        baselineCartCount,
        minDelta,
        options,
        onStatus,
        atcState,
      );
      if (result === "reloading") {
        return false;
      }
      return result === "confirmed";
    },
    waitForCartDelta: async (waitMinDelta) => {
      if (atcState.confirmedViaApi) {
        return true;
      }
      onStatus("Waiting for cart…");
      return isCartConfirmed(document, baselineCartCount, waitMinDelta);
    },
    navigate: (url) => {
      onStatus("Going to checkout…");
      location.assign(url);
    },
  });

  if (addResult.ok) {
    return addResult;
  }

  if (!shouldContinue()) {
    return { ok: false, error: "Stopped" };
  }

  if (readRetailerAutoResume()) {
    return { ok: false, error: "Reloading" };
  }

  return addResult;
}
