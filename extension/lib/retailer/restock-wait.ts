import {
  mainAddToCartButtonId,
  parseTargetTcinFromUrl,
} from "@ext/lib/retailer/main-add-to-cart.ts";

const FULFILLMENT_SECTION = '[data-test="@web/AddToCart/FulfillmentSection"]';
const FULFILLMENT_TAB_SELECTOR = 'button[data-test^="fulfillment-cell-"]';

export function isRestockWaitPage(doc: Document, pageUrl: string): boolean {
  const tcin = parseTargetTcinFromUrl(pageUrl);
  if (!tcin) {
    return false;
  }

  const tcinButton = doc.getElementById(mainAddToCartButtonId(tcin));
  if (!tcinButton) {
    return false;
  }

  if (doc.querySelector('[data-test="NonbuyableSection"]')) {
    return true;
  }

  if (doc.querySelector('[data-test="outOfStockMessage"]')) {
    return true;
  }

  const fulfillment = doc.querySelector(FULFILLMENT_SECTION);
  if (fulfillment && !doc.querySelector(FULFILLMENT_TAB_SELECTOR)) {
    return true;
  }

  return false;
}

export function waitingForAddToCartStatus(doc: Document, pageUrl: string): string {
  return isRestockWaitPage(doc, pageUrl)
    ? "Waiting for restock…"
    : "Waiting for main Add to cart…";
}
