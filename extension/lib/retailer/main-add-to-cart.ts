import { unwrapAffiliateUrl } from "@ext/lib/affiliate-unwrap.ts";

import { maybeHardRefreshWhileWaiting } from "@ext/lib/retailer/page-refresh.ts";
import { isElementActionable } from "./dom.ts";

export const MAIN_ADD_TO_CART_SCOPES = [
  '[data-test="@web/AddToCart/FulfillmentSection"]',
  '[data-test="@web/AddToCart/Fulfillment/ShippingSection"]',
  '[data-test="StickyAddToCartFulfillmentSection"]',
] as const;

const ADD_TO_CART_EXCLUDED_ANCESTORS = [
  '[data-test*="addToCartSuccess"]',
  '[data-test*="RecommendationsTile"]',
  '[data-test="addToCartSuccessModalRecommendations"]',
] as const;

const RECOMMENDATION_DATA_TESTS = new Set(["chooseOptionsButton"]);
const MAIN_ADD_TO_CART_ID_PREFIX = "addToCartButtonOrTextIdFor";

const ADD_TO_CART_TEXT = /add to cart|ship it|pick it up|order pickup/i;

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

function isRecommendationButton(element: HTMLElement): boolean {
  const dataTest = element.getAttribute("data-test");
  return dataTest !== null && RECOMMENDATION_DATA_TESTS.has(dataTest);
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
    isRecommendationButton(element) ||
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

export type WaitForMainAddToCartOptions = {
  selectors: string[];
  timeoutMs: number | null;
  shouldContinue: () => boolean;
  pageUrl?: string;
  onStatus?: (status: string) => void;
  refreshIntervalSec?: number;
  getRefreshIntervalSec?: () => number;
  requestHardReload?: () => Promise<void>;
};

export async function waitForMainAddToCartButton(
  selectorsOrOptions: string[] | WaitForMainAddToCartOptions,
  timeoutMs?: number | null,
  shouldContinue?: () => boolean,
  pageUrl?: string,
  onStatus?: (status: string) => void,
): Promise<HTMLElement | null> {
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
  } = options;

  const resolveRefreshIntervalSec = (): number =>
    getRefreshIntervalSec?.() ?? refreshIntervalSec;

  const deadline = waitTimeoutMs === null ? null : Date.now() + waitTimeoutMs;
  let reportedWaiting = false;

  while (deadline === null || Date.now() < deadline) {
    if (!continueFn()) {
      return null;
    }

    const waitState = resolveMainAddToCartWaitState(selectors, resolvedPageUrl);
    if (waitState.kind === "ready") {
      return waitState.element;
    }

    if (waitState.kind === "waiting_disabled") {
      if (statusFn && !reportedWaiting) {
        statusFn("Waiting for main Add to cart…");
        reportedWaiting = true;
      }

      if (requestHardReload) {
        const refresh = await maybeHardRefreshWhileWaiting({
          refreshIntervalSec: resolveRefreshIntervalSec(),
          shouldContinue: continueFn,
          onStatus: statusFn,
          requestHardReload,
        });
        if (refresh === "reloading" || refresh === "aborted") {
          return null;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return null;
}
