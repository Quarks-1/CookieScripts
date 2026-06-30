import { activateElement } from "@ext/domains/target/lib/dom.ts";
import { PLACE_ORDER_ENABLED_SELECTOR } from "@ext/domains/target/lib/checkout/selectors.ts";

export type PlaceOrderClickState = {
  clicked: boolean;
};

export function createPlaceOrderClickState(): PlaceOrderClickState {
  return { clicked: false };
}

/** Click enabled place-order button at most once per automation run. */
export function clickPlaceOrderOnce(
  state: PlaceOrderClickState,
  doc: Document = document,
): boolean {
  if (state.clicked) {
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
