import { activateElement } from "@ext/domains/samsclub/lib/dom.ts";
import { isCheckoutPageLoading } from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import { canSafelyPlaceOrder } from "@ext/domains/samsclub/lib/checkout/cvv.ts";
import { PLACE_ORDER_ENABLED_SELECTOR } from "@ext/domains/samsclub/lib/checkout/selectors.ts";

export type PlaceOrderClickState = {
  clicked: boolean;
};

export function createPlaceOrderClickState(): PlaceOrderClickState {
  return { clicked: false };
}

export function resetPlaceOrderClickState(state: PlaceOrderClickState): void {
  state.clicked = false;
}

/** Click enabled place-order button at most once per automation run. */
export function clickPlaceOrderOnce(
  state: PlaceOrderClickState,
  doc: Document = document,
  pageUrl?: string,
): boolean {
  if (state.clicked) {
    return false;
  }

  if (isCheckoutPageLoading(doc) || !canSafelyPlaceOrder(doc, pageUrl)) {
    return false;
  }

  const button = doc.querySelector(PLACE_ORDER_ENABLED_SELECTOR);
  if (!(button instanceof HTMLButtonElement)) {
    return false;
  }

  activateElement(button);
  state.clicked = true;
  return true;
}
