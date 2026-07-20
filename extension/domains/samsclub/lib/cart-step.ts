import { activateElement, queryActionable } from "./dom.ts";

const CART_COUNT_SELECTORS = [
  "#cart-button-header",
  '[data-automation-id="cart-button-header"]',
  '[data-test="@web/CartLinkQuantity"]',
  '[data-test="@web/CartLink"]',
  '[data-test="@web/CartIcon"]',
  '[data-test="cart-count"]',
  '[data-test="cartCount"]',
  'a[href*="/cart"] [data-test="@web/CartLinkQuantity"]',
  'a[href*="/cart"]',
  'a[aria-label*="cart" i]',
  'button[aria-label*="Cart contains" i]',
];

const ADDED_TO_CART_PATTERNS = [
  /added to (?:your )?cart/i,
  /item added/i,
  /\d+\s+in\s+cart/i,
];

const CART_ARIA_COUNT = /cart\s+(\d+)\s+items?/i;
const CART_CONTAINS_COUNT = /cart\s+contains\s+(\d+)\s+items?/i;

const CART_ADD_FAILURE_PATTERNS = [
  /item not added to (?:your )?cart/i,
  /not added to your cart/i,
  /something went wrong.*not added/i,
] as const;

const CART_ADD_FAILURE_DIALOG_SELECTORS = [
  '.ReactModal__Content[role="dialog"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-test*="modal" i]',
] as const;

const CART_ADD_FAILURE_CLOSE_SELECTORS = [
  'button[aria-label="Close"]',
  'button[aria-label="close"]',
  'button[class*="styles_ndsButtonClose"]',
  'button[class*="styles_close"]',
  'button[data-test*="close" i]',
  'button[data-test*="modalClose" i]',
] as const;

const CART_ADD_SUCCESS_ZONE = '[data-test*="addToCartSuccess"]';

function elementCountText(el: Element): string {
  const parts = [el.textContent, el.getAttribute("aria-label")].filter(
    (value) => value != null && value.trim() !== "",
  );
  return parts.join(" ");
}

export function parseCartCount(text: string): number | null {
  const containsMatch = text.match(CART_CONTAINS_COUNT);
  if (containsMatch) {
    const value = Number.parseInt(containsMatch[1], 10);
    return Number.isFinite(value) ? value : null;
  }

  const ariaMatch = text.match(CART_ARIA_COUNT);
  if (ariaMatch) {
    const value = Number.parseInt(ariaMatch[1], 10);
    return Number.isFinite(value) ? value : null;
  }

  const match = text.match(/\d+/);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) ? value : null;
}

export function readCartCountFromDocument(doc: Document): number {
  for (const selector of CART_COUNT_SELECTORS) {
    const el = doc.querySelector(selector);
    if (!el) {
      continue;
    }
    const count = parseCartCount(elementCountText(el));
    if (count !== null) {
      return count;
    }
  }
  return 0;
}

export function hasCartSuccessLiveRegion(doc: Document): boolean {
  const regions = doc.querySelectorAll('[aria-live="polite"], [role="status"], [role="alert"]');
  for (const region of regions) {
    const text = region.textContent ?? "";
    if (ADDED_TO_CART_PATTERNS.some((pattern) => pattern.test(text))) {
      return true;
    }
    const lower = text.toLowerCase();
    if (lower.includes("added") && lower.includes("cart")) {
      return true;
    }
  }

  return false;
}

function isPostAddConfirmationPage(doc: Document): boolean {
  const path = doc.defaultView?.location.pathname ?? "";
  return path === "/pac" || path.startsWith("/pac/");
}

export function hasCartAddSuccessUi(doc: Document): boolean {
  if (isPostAddConfirmationPage(doc)) {
    return true;
  }

  if (doc.querySelector('[data-test*="addToCartSuccess"]')) {
    return true;
  }

  const sticky = doc.querySelector('[data-test="StickyAddToCartFulfillmentSection"]');
  if (sticky && /\d+\s+in\s+cart/i.test(sticky.textContent ?? "")) {
    return true;
  }

  const buttons = doc.querySelectorAll("button");
  for (const button of buttons) {
    const text = button.textContent?.trim() ?? "";
    if (/^\d+\s+in\s+cart$/i.test(text)) {
      return true;
    }
  }

  return hasCartSuccessLiveRegion(doc);
}

export function cartCountIncreased(before: number, after: number, minDelta: number): boolean {
  return after - before >= minDelta;
}

export function isCartConfirmed(
  doc: Document,
  baselineCount: number,
  minDelta: number,
): boolean {
  const after = readCartCountFromDocument(doc);
  return cartCountIncreased(baselineCount, after, minDelta) || hasCartAddSuccessUi(doc);
}

function isCartAddFailureText(text: string): boolean {
  return CART_ADD_FAILURE_PATTERNS.some((pattern) => pattern.test(text));
}

function isInsideSuccessZone(element: Element): boolean {
  return element.matches(CART_ADD_SUCCESS_ZONE) || element.closest(CART_ADD_SUCCESS_ZONE) != null;
}

function findCartAddFailureDialog(doc: Document): HTMLElement | null {
  const errorContent = doc.querySelector('[data-test="errorContent"]');
  if (errorContent instanceof HTMLElement && !isInsideSuccessZone(errorContent)) {
    const dialog = errorContent.closest('[role="dialog"]');
    if (dialog instanceof HTMLElement) {
      return dialog;
    }
    return errorContent;
  }

  for (const selector of CART_ADD_FAILURE_DIALOG_SELECTORS) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = doc.querySelectorAll(selector);
    } catch {
      continue;
    }

    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || isInsideSuccessZone(node)) {
        continue;
      }
      const text = node.textContent ?? "";
      if (isCartAddFailureText(text)) {
        return node;
      }
    }
  }

  return findCartAddFailureDialogViaCloseButton(doc);
}

/** Target's ATC error overlay may omit role=dialog; locate via the nds close button. */
function findCartAddFailureDialogViaCloseButton(doc: Document): HTMLElement | null {
  for (const selector of CART_ADD_FAILURE_CLOSE_SELECTORS) {
    let buttons: NodeListOf<Element>;
    try {
      buttons = doc.querySelectorAll(selector);
    } catch {
      continue;
    }

    for (const button of buttons) {
      if (!(button instanceof HTMLElement)) {
        continue;
      }

      let el: Element | null = button.parentElement;
      for (let depth = 0; depth < 12 && el != null && el !== doc.body; depth += 1) {
        if (!(el instanceof HTMLElement) || isInsideSuccessZone(el)) {
          el = el.parentElement;
          continue;
        }
        const text = el.textContent ?? "";
        if (isCartAddFailureText(text) && text.length <= 4_000) {
          return el;
        }
        el = el.parentElement;
      }
    }
  }

  return null;
}

export function hasCartAddFailureUi(doc: Document): boolean {
  return findCartAddFailureDialog(doc) !== null;
}

export function dismissCartAddFailureModal(doc: Document): boolean {
  const dialog = findCartAddFailureDialog(doc);
  if (!dialog) {
    return false;
  }

  const closeButton = queryActionable([...CART_ADD_FAILURE_CLOSE_SELECTORS], dialog);
  if (!closeButton) {
    return false;
  }

  activateElement(closeButton);
  return true;
}
