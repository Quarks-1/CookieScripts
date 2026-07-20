/** Sam's Club PDP ATC selectors — see extension/domains/samsclub/docs/SAMSCLUB_AUTOMATION.md */
export const DEFAULT_ADD_TO_CART_SELECTORS = [
  'button[data-automation-id="atc"]',
  'button[aria-label^="Add to Cart"]',
  'button[aria-label*="Add to cart" i]',
];

export const SHIP_IT_SELECTORS: string[] = [];

export const SAMSCLUB_CART_URL = "https://www.samsclub.com/cart";

export const SAMSCLUB_CHECKOUT_BUTTON_SELECTORS = [
  '[data-automation-id="checkout"]',
  "#Continue\\ to\\ checkout\\ button",
];

/** Resolved at navigate time via resolveCheckoutStartUrl(). */
export const CHECKOUT_START_URL = "https://www.samsclub.com/checkout";
