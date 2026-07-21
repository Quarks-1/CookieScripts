import { unwrapAffiliateUrl } from "@ext/core/lib/affiliate-unwrap.ts";

import { runWaitingDisabledTick } from "@ext/domains/target/lib/waiting-disabled.ts";
import { shouldUseBackendAtc } from "@ext/domains/target/lib/atc-route.ts";
import { isOosSignal } from "@ext/domains/target/lib/restock-wait.ts";
import { isElementActionable } from "./dom.ts";

export const MAIN_ADD_TO_CART_SCOPES = [
  '[data-test="@web/AddToCart/FulfillmentSection"]',
  '[data-test="@web/AddToCart/Fulfillment/ShippingSection"]',
  '[data-test="StickyAddToCartFulfillmentSection"]',
] as const;

const STICKY_SCOPE_SELECTOR = '[data-test="StickyAddToCartFulfillmentSection"]';

const ADD_TO_CART_EXCLUDED_ANCESTORS = [
  '[data-test*="addToCartSuccess"]',
  '[data-test*="RecommendationsTile"]',
  '[data-test="addToCartSuccessModalRecommendations"]',
] as const;

const NON_ATC_DATA_TESTS = new Set(["chooseOptionsButton", "showInStockPrimaryButton"]);
const MAIN_ADD_TO_CART_ID_PREFIX = "addToCartButtonOrTextIdFor";

const ADD_TO_CART_TEXT = /add to cart|ship it|pick it up|order pickup/i;
const FIND_ALTERNATIVE_TEXT = /^find alternative$/i;

export function parseTargetTcinFromUrl(url: string): string | null {
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    const match = parsed.pathname.match(/\/A-(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function mainAddToCartButtonId(tcin: string): string {
  return `${MAIN_ADD_TO_CART_ID_PREFIX}${tcin}`;
}

function isInsideExcludedZone(element: Element): boolean {
  for (const selector of ADD_TO_CART_EXCLUDED_ANCESTORS) {
    if (element.closest(selector)) {
      return true;
    }
  }
  return false;
}

function isNonAtcButton(element: HTMLElement): boolean {
  const dataTest = element.getAttribute("data-test");
  if (dataTest !== null && NON_ATC_DATA_TESTS.has(dataTest)) {
    return true;
  }
  const text = element.textContent?.trim() ?? "";
  return FIND_ALTERNATIVE_TEXT.test(text);
}

export function matchesPageTcinId(element: HTMLElement, tcin: string | null): boolean {
  if (!element.id.startsWith(MAIN_ADD_TO_CART_ID_PREFIX)) {
    return true;
  }
  return tcin !== null && element.id === mainAddToCartButtonId(tcin);
}

function acceptMainProductButton(
  element: HTMLElement,
  requireActionable: boolean,
  tcin: string | null,
): boolean {
  if (
    isInsideExcludedZone(element) ||
    isNonAtcButton(element) ||
    !matchesPageTcinId(element, tcin)
  ) {
    return false;
  }
  if (requireActionable && !isElementActionable(element)) {
    return false;
  }
  return true;
}

function findInScopes(
  selectors: string[],
  requireActionable: boolean,
  tcin: string | null,
): HTMLElement | null {
  for (const scopeSelector of MAIN_ADD_TO_CART_SCOPES) {
    const scopes = document.querySelectorAll(scopeSelector);
    for (const scope of scopes) {
      if (scopeSelector === STICKY_SCOPE_SELECTOR) {
        const stickyButton = getTcinButton(tcin);
        if (
          stickyButton &&
          scope.contains(stickyButton) &&
          acceptMainProductButton(stickyButton, requireActionable, tcin)
        ) {
          return stickyButton;
        }
        continue;
      }

      for (const selector of selectors) {
        const nodes = scope.querySelectorAll(selector);
        for (const node of nodes) {
          if (
            node instanceof HTMLElement &&
            acceptMainProductButton(node, requireActionable, tcin)
          ) {
            return node;
          }
        }
      }

      const buttons = scope.querySelectorAll("button");
      for (const node of buttons) {
        if (!(node instanceof HTMLElement) || !acceptMainProductButton(node, requireActionable, tcin)) {
          continue;
        }
        const text = node.textContent?.trim() ?? "";
        const aria = node.getAttribute("aria-label") ?? "";
        if (ADD_TO_CART_TEXT.test(`${text} ${aria}`)) {
          return node;
        }
      }
    }
  }

  return null;
}

function getTcinButton(tcin: string | null): HTMLElement | null {
  if (!tcin) {
    return null;
  }
  const byId = document.getElementById(mainAddToCartButtonId(tcin));
  return byId instanceof HTMLElement ? byId : null;
}

export type FindMainAddToCartOptions = {
  pageUrl?: string;
  requireActionable?: boolean;
};

export type MainAddToCartWaitState =
  | { kind: "ready"; element: HTMLElement }
  | { kind: "waiting_disabled"; element: HTMLElement }
  | { kind: "not_found" };

export function resolveMainAddToCartWaitState(
  selectors: string[],
  pageUrl?: string,
): MainAddToCartWaitState {
  const resolvedPageUrl = pageUrl ?? (typeof location !== "undefined" ? location.href : "");
  const tcin = parseTargetTcinFromUrl(resolvedPageUrl);

  const ready = findMainAddToCartButton(selectors, {
    pageUrl: resolvedPageUrl,
    requireActionable: true,
  });
  if (ready) {
    return { kind: "ready", element: ready };
  }

  const tcinButton = getTcinButton(tcin);
  if (tcinButton && acceptMainProductButton(tcinButton, false, tcin)) {
    return { kind: "waiting_disabled", element: tcinButton };
  }

  const scoped = findInScopes(selectors, false, tcin);
  if (scoped && !isElementActionable(scoped)) {
    return { kind: "waiting_disabled", element: scoped };
  }

  return { kind: "not_found" };
}

export function findMainAddToCartButton(
  selectors: string[],
  options: FindMainAddToCartOptions = {},
): HTMLElement | null {
  const requireActionable = options.requireActionable !== false;
  const pageUrl = options.pageUrl ?? (typeof location !== "undefined" ? location.href : "");
  const tcin = parseTargetTcinFromUrl(pageUrl);

  const tcinButton = getTcinButton(tcin);
  if (tcinButton && acceptMainProductButton(tcinButton, requireActionable, tcin)) {
    return tcinButton;
  }

  return findInScopes(selectors, requireActionable, tcin);
}

export type WaitForAtcResult =
  | { kind: "ready"; element: HTMLElement }
  | { kind: "api_added" };

export type WaitForMainAddToCartOptions = {
  selectors: string[];
  timeoutMs: number | null;
  shouldContinue: () => boolean;
  pageUrl?: string;
  onStatus?: (status: string) => void;
  refreshIntervalSec?: number;
  getRefreshIntervalSec?: () => number;
  requestHardReload?: () => Promise<void>;
  frontendAtcEnabled?: boolean;
  backendAtcEnabled?: boolean;
  getEffectiveQuantity?: () => number;
  stopOnOosEnabled?: boolean;
  closeTabOnOosEnabled?: boolean;
  onOosConfirmed?: () => void;
};

export async function waitForMainAddToCartButton(
  selectorsOrOptions: string[] | WaitForMainAddToCartOptions,
  timeoutMs?: number | null,
  shouldContinue?: () => boolean,
  pageUrl?: string,
  onStatus?: (status: string) => void,
): Promise<WaitForAtcResult | null> {
  const options: WaitForMainAddToCartOptions = Array.isArray(selectorsOrOptions)
    ? {
        selectors: selectorsOrOptions,
        timeoutMs: timeoutMs ?? null,
        shouldContinue: shouldContinue ?? (() => true),
        pageUrl,
        onStatus,
      }
    : selectorsOrOptions;

  const {
    selectors,
    timeoutMs: waitTimeoutMs,
    shouldContinue: continueFn,
    pageUrl: resolvedPageUrl,
    onStatus: statusFn,
    refreshIntervalSec = 0,
    getRefreshIntervalSec,
    requestHardReload,
    frontendAtcEnabled = true,
    backendAtcEnabled = false,
    getEffectiveQuantity,
    stopOnOosEnabled = false,
    closeTabOnOosEnabled = false,
    onOosConfirmed,
  } = options;

  const resolveRefreshIntervalSec = (): number =>
    getRefreshIntervalSec?.() ?? refreshIntervalSec;

  const deadline = waitTimeoutMs === null ? null : Date.now() + waitTimeoutMs;
  let reportedWaiting = false;
  let lastCartApiProbeMs: number | null = null;
  let consecutiveOosTicks = 0;
  const pageUrlForWait = resolvedPageUrl ?? "";
  const tcin = parseTargetTcinFromUrl(pageUrlForWait);

  while (deadline === null || Date.now() < deadline) {
    if (!continueFn()) {
      return null;
    }

    const waitState = resolveMainAddToCartWaitState(selectors, resolvedPageUrl);
    const effectiveQuantity = getEffectiveQuantity?.() ?? 1;
    const useBackendAtc = shouldUseBackendAtc(
      backendAtcEnabled,
      frontendAtcEnabled,
      effectiveQuantity,
      waitState.kind,
    );

    let tickOutcome: "continue" | "reloading" | "aborted" | "cart_added" | "out_of_stock" | undefined;

    if (useBackendAtc) {
      const tick = await runWaitingDisabledTick({
        pageUrl: pageUrlForWait,
        tcin,
        backendAtcEnabled,
        onStatus: statusFn,
        shouldContinue: continueFn,
        refreshIntervalSec: resolveRefreshIntervalSec(),
        getRefreshIntervalSec,
        requestHardReload,
        lastCartApiProbeMs,
        reportedWaiting,
        getEffectiveQuantity,
      });
      lastCartApiProbeMs = tick.lastCartApiProbeMs;
      reportedWaiting = tick.reportedWaiting;
      tickOutcome = tick.outcome;

      if (tick.outcome === "cart_added") {
        return { kind: "api_added" };
      }
      if (tick.outcome === "reloading" || tick.outcome === "aborted") {
        return null;
      }
    } else if (waitState.kind === "waiting_disabled") {
      const tick = await runWaitingDisabledTick({
        pageUrl: pageUrlForWait,
        tcin,
        backendAtcEnabled: false,
        onStatus: statusFn,
        shouldContinue: continueFn,
        refreshIntervalSec: resolveRefreshIntervalSec(),
        getRefreshIntervalSec,
        requestHardReload,
        lastCartApiProbeMs,
        reportedWaiting,
        getEffectiveQuantity,
      });
      lastCartApiProbeMs = tick.lastCartApiProbeMs;
      reportedWaiting = tick.reportedWaiting;
      tickOutcome = tick.outcome;

      if (tick.outcome === "reloading" || tick.outcome === "aborted") {
        return null;
      }
    }

    const oosThisTick =
      tickOutcome === "out_of_stock" || isOosSignal(document, pageUrlForWait);
    if (oosThisTick) {
      consecutiveOosTicks += 1;
    } else {
      consecutiveOosTicks = 0;
    }

    if (
      consecutiveOosTicks >= 2 &&
      (stopOnOosEnabled || closeTabOnOosEnabled)
    ) {
      onOosConfirmed?.();
      return null;
    }

    if (waitState.kind === "ready" && frontendAtcEnabled) {
      return { kind: "ready", element: waitState.element };
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return null;
}
