import { activateElement } from "@ext/domains/target/lib/dom.ts";
import {
  ADDRESS_SELECTION_RADIO,
  SAVE_AND_CONTINUE_PREFIX,
  STEP_PAYMENT_SELECTOR,
  STEP_SHIPPING_SELECTOR,
} from "@ext/domains/target/lib/checkout/selectors.ts";

function firstVisibleSaveAndContinue(doc: Document): HTMLButtonElement | null {
  for (const el of doc.querySelectorAll(SAVE_AND_CONTINUE_PREFIX)) {
    if (el instanceof HTMLButtonElement && !el.disabled) {
      return el;
    }
  }
  return null;
}

function ensureShippingAddressSelected(doc: Document): void {
  if (!doc.querySelector(STEP_SHIPPING_SELECTOR)) {
    return;
  }
  const radios = doc.querySelectorAll(ADDRESS_SELECTION_RADIO);
  for (const radio of radios) {
    if (radio instanceof HTMLInputElement && radio.type === "radio") {
      if (!radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
  }
}

function ensurePaymentSelected(doc: Document): void {
  if (!doc.querySelector(STEP_PAYMENT_SELECTOR)) {
    return;
  }
  const radios = doc.querySelectorAll(`${STEP_PAYMENT_SELECTOR} input[type="radio"]`);
  for (const radio of radios) {
    if (radio instanceof HTMLInputElement && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }
}

/** One tick of mid-step checkout clicks. Returns true if an action was taken. */
export function runCheckoutStepTick(doc: Document = document): boolean {
  ensureShippingAddressSelected(doc);
  ensurePaymentSelected(doc);

  const saveButton = firstVisibleSaveAndContinue(doc);
  if (saveButton) {
    activateElement(saveButton);
    return true;
  }

  return false;
}
