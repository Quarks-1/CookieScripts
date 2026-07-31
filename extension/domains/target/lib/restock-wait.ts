import type { CartApiProbeResult } from "@ext/domains/target/lib/cart-api.ts";
import {
  mainAddToCartButtonId,
  parseTargetTcinFromUrl,
} from "@ext/domains/target/lib/main-add-to-cart.ts";

const FULFILLMENT_SECTION = '[data-test="@web/AddToCart/FulfillmentSection"]';
const FULFILLMENT_TAB_SELECTOR = 'button[data-test^="fulfillment-cell-"]';
const NON_ATC_DATA_TESTS = new Set(["showInStockPrimaryButton", "chooseOptionsButton"]);

/** Stable DOM OOS before stop/close-on-OOS actions fire. */
export const TARGET_OOS_STABLE_MS = 2_000;

export function getMainFulfillmentSection(doc: Document): Element | null {
  return doc.querySelector(FULFILLMENT_SECTION);
}

export function hasFulfillmentTabs(doc: Document, root: ParentNode = doc): boolean {
  return root.querySelector(FULFILLMENT_TAB_SELECTOR) !== null;
}

function isEnabledMainAtcButton(button: HTMLButtonElement): boolean {
  if (button.disabled) {
    return false;
  }
  const dataTest = button.getAttribute("data-test");
  return dataTest === null || !NON_ATC_DATA_TESTS.has(dataTest);
}

function fulfillmentTabLooksAvailable(tab: Element): boolean {
  const aria = tab.getAttribute("aria-label") ?? "";
  const text = tab.textContent ?? "";
  const combined = `${aria} ${text}`;
  if (/not available/i.test(combined)) {
    return false;
  }
  return /arrives|ready within|check availability|ships free/i.test(combined);
}

export function hasPositiveFulfillmentPath(doc: Document, tcin: string): boolean {
  const button = doc.getElementById(mainAddToCartButtonId(tcin));
  if (button instanceof HTMLButtonElement && isEnabledMainAtcButton(button)) {
    return true;
  }

  const fulfillment = getMainFulfillmentSection(doc);
  if (!fulfillment) {
    return false;
  }

  const tabs = fulfillment.querySelectorAll(FULFILLMENT_TAB_SELECTOR);
  for (const tab of tabs) {
    if (fulfillmentTabLooksAvailable(tab)) {
      return true;
    }
  }

  return false;
}

function isProductWideOutOfStockMessage(element: Element): boolean {
  const text = (element.textContent ?? "").trim();
  if (!/out of stock/i.test(text)) {
    return false;
  }
  return !/out of stock at\b/i.test(text);
}

export function hasScopedProductOosEvidence(doc: Document, fulfillment: Element): boolean {
  if (fulfillment.querySelector('[data-test="NonbuyableSection"]')) {
    return true;
  }

  const oosMessage = fulfillment.querySelector('[data-test="outOfStockMessage"]');
  if (oosMessage && isProductWideOutOfStockMessage(oosMessage)) {
    return true;
  }

  if (!hasFulfillmentTabs(doc, fulfillment)) {
    const sectionText = fulfillment.textContent ?? "";
    if (/out of stock/i.test(sectionText) && !/out of stock at\b/i.test(sectionText)) {
      return true;
    }
  }

  return false;
}

export function isTargetPdpHydrationPending(doc: Document, pageUrl: string): boolean {
  const tcin = parseTargetTcinFromUrl(pageUrl);
  if (!tcin) {
    return true;
  }

  if (!getMainFulfillmentSection(doc)) {
    return true;
  }

  const tcinButton = doc.getElementById(mainAddToCartButtonId(tcin));
  return tcinButton === null;
}

export function isRestockWaitPage(doc: Document, pageUrl: string): boolean {
  const tcin = parseTargetTcinFromUrl(pageUrl);
  if (!tcin) {
    return false;
  }

  if (isTargetPdpHydrationPending(doc, pageUrl)) {
    return false;
  }

  if (hasPositiveFulfillmentPath(doc, tcin)) {
    return false;
  }

  const tcinButton = doc.getElementById(mainAddToCartButtonId(tcin));
  if (!(tcinButton instanceof HTMLButtonElement) || !tcinButton.disabled) {
    return false;
  }

  const fulfillment = getMainFulfillmentSection(doc);
  if (!fulfillment) {
    return false;
  }

  return hasScopedProductOosEvidence(doc, fulfillment);
}

export function waitingForAddToCartStatus(doc: Document, pageUrl: string): string {
  return isRestockWaitPage(doc, pageUrl)
    ? "Waiting for restock…"
    : "Waiting for main Add to cart…";
}

export function isOosSignal(
  doc: Document,
  pageUrl: string,
  cartProbeResult?: CartApiProbeResult,
): boolean {
  if (cartProbeResult?.kind === "out_of_stock") {
    return true;
  }
  return isRestockWaitPage(doc, pageUrl);
}
