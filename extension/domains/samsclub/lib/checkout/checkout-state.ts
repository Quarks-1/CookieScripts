import { isCheckoutPageLoading, isOrderConfirmationUrl } from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import {
  isCheckoutCvvRequired,
} from "@ext/domains/samsclub/lib/checkout/cvv.ts";
import {
  ACTIVE_STEP_HEADING_SELECTOR,
  CHECKOUT_CONTAINER_SELECTOR,
  PLACE_ORDER_BUTTON_SELECTOR,
  SAVE_AND_CONTINUE_PREFIX,
} from "@ext/domains/samsclub/lib/checkout/selectors.ts";

export type CheckoutAutomationState =
  | "loading_or_error"
  | "mid_step"
  | "needs_cvv"
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
  if (isCheckoutPageLoading(doc)) {
    return false;
  }
  if (doc.querySelector(CHECKOUT_CONTAINER_SELECTOR)) {
    return true;
  }
  return doc.querySelector(PLACE_ORDER_BUTTON_SELECTOR) !== null;
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

  if (isCheckoutCvvRequired(doc, pageUrl)) {
    return "needs_cvv";
  }

  if (isPlaceOrderEnabled(doc)) {
    return "ready_to_place";
  }

  return "loading_or_error";
}

export function readActiveStepHeading(doc: Document): string | null {
  const el = doc.querySelector(ACTIVE_STEP_HEADING_SELECTOR);
  return el?.textContent?.trim() ?? null;
}
