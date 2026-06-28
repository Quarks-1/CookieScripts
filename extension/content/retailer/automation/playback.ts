import {
  isCartConfirmed,
  readCartCountFromDocument,
} from "@ext/lib/retailer/cart-step.ts";
import { retryUntilConfirmed } from "@ext/lib/retailer/cart-retry.ts";
import {
  findMainAddToCartButton,
  resolveMainAddToCartWaitState,
  waitForMainAddToCartButton,
} from "@ext/lib/retailer/main-add-to-cart.ts";
import { maybeHardRefreshWhileWaiting } from "@ext/lib/retailer/page-refresh.ts";
import { readRetailerAutoResume } from "@ext/lib/retailer/auto-resume.ts";
import { activateElement } from "@ext/lib/retailer/dom.ts";
import { runPlaybackEngine } from "@ext/lib/retailer/playback-engine.ts";
import { resolveAutomationSteps } from "@ext/lib/retailer/resolve-steps.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/content/retailer/selectors.ts";
import type { AutomationStep, RetailerProfile } from "@ext/types/retailer.ts";

const OPTIONAL_CLICK_TIMEOUT_MS = 3_000;
const POST_ACTION_DELAY_MS = 600;
const ADD_TO_CART_RETRY_INTERVAL_MS = 10;

export type AutomationPlaybackOptions = {
  shouldContinue: () => boolean;
  refreshIntervalSec: number;
  getRefreshIntervalSec?: () => number;
  requestHardReload: () => Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
): Promise<"confirmed" | "aborted" | "reloading"> {
  const resolvedSelectors = selectors.length ? selectors : DEFAULT_ADD_TO_CART_SELECTORS;
  let attempts = 0;
  let reportedWaiting = false;
  let reloading = false;

  const result = await retryUntilConfirmed({
    retryIntervalMs: ADD_TO_CART_RETRY_INTERVAL_MS,
    shouldContinue: () => options.shouldContinue() && !reloading,
    isConfirmed: () => isCartConfirmed(document, baselineCount, minDelta),
    tryAction: async () => {
      const waitState = resolveMainAddToCartWaitState(resolvedSelectors, location.href);
      if (waitState.kind === "waiting_disabled") {
        if (!reportedWaiting) {
          onStatus("Waiting for main Add to cart…");
          reportedWaiting = true;
        }
        const refresh = await maybeHardRefreshWhileWaiting({
          refreshIntervalSec: options.getRefreshIntervalSec?.() ?? options.refreshIntervalSec,
          shouldContinue: options.shouldContinue,
          onStatus,
          requestHardReload: options.requestHardReload,
        });
        if (refresh === "reloading") {
          reloading = true;
        }
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

  return result;
}

export async function runAutomationPlayback(
  steps: AutomationStep[],
  onStatus: (status: string) => void,
  options: AutomationPlaybackOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const baselineCartCount = readCartCountFromDocument(document);
  const minDelta = cartMinDelta(steps);
  const { shouldContinue, refreshIntervalSec, getRefreshIntervalSec, requestHardReload } = options;
  const resolveRefreshIntervalSec = () => getRefreshIntervalSec?.() ?? refreshIntervalSec;

  const addResult = await runPlaybackEngine(steps, {
    click: async (selectors, optional = false) => {
      onStatus(optional ? "Checking fulfillment…" : "Clicking…");
      const element = await waitForMainAddToCartButton({
        selectors,
        timeoutMs: optional ? OPTIONAL_CLICK_TIMEOUT_MS : null,
        shouldContinue,
        pageUrl: location.href,
        onStatus,
        refreshIntervalSec: optional ? 0 : resolveRefreshIntervalSec(),
        getRefreshIntervalSec: optional ? undefined : resolveRefreshIntervalSec,
        requestHardReload: optional ? undefined : requestHardReload,
      });
      if (!element) {
        return optional;
      }
      activateElement(element);
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
      );
      if (result === "reloading") {
        return false;
      }
      return result === "confirmed";
    },
    waitForCartDelta: async (waitMinDelta) => {
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

export function resolvePlaybackSteps(profile?: RetailerProfile | null): AutomationStep[] {
  return resolveAutomationSteps(profile);
}
