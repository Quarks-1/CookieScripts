import { isOrderConfirmationUrl } from "@ext/lib/retailer/checkout/checkout-url.ts";
import {
  ACTIVE_STEP_HEADING_SELECTOR,
  CHECKOUT_CONTAINER_SELECTOR,
  PLACE_ORDER_BUTTON_SELECTOR,
  SAVE_AND_CONTINUE_PREFIX,
} from "@ext/lib/retailer/checkout/selectors.ts";

export type CheckoutAutomationState =
  | "loading_or_error"
  | "mid_step"
  | "ready_to_place"
  | "success";

export function countSaveAndContinueButtons(doc: Document): number {
  return doc.querySelectorAll(SAVE_AND_CONTINUE_PREFIX).length;
}

export function isPlaceOrderEnabled(doc: Document): boolean {
  const button = doc.querySelector(PLACE_ORDER_BUTTON_SELECTOR);
  return button instanceof HTMLButtonElement && !button.disabled;
}

export function isCheckoutShellLoaded(doc: Document): boolean {
  return doc.querySelector(CHECKOUT_CONTAINER_SELECTOR) !== null;
}

export function resolveCheckoutState(
  pageUrl: string,
  doc: Document = document,
): CheckoutAutomationState {
  if (isOrderConfirmationUrl(pageUrl)) {
    return "success";
  }

  if (!isCheckoutShellLoaded(doc)) {
    return "loading_or_error";
  }

  if (countSaveAndContinueButtons(doc) > 0) {
    return "mid_step";
  }

  if (isPlaceOrderEnabled(doc)) {
    return "ready_to_place";
  }

  const placeOrder = doc.querySelector(PLACE_ORDER_BUTTON_SELECTOR);
  if (placeOrder) {
    return "mid_step";
  }

  return "loading_or_error";
}

export function readActiveStepHeading(doc: Document): string | null {
  const el = doc.querySelector(ACTIVE_STEP_HEADING_SELECTOR);
  return el?.textContent?.trim() ?? null;
}
