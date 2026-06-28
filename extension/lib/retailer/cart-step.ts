const CART_COUNT_SELECTORS = [
  '[data-test="@web/CartLinkQuantity"]',
  '[data-test="@web/CartLink"]',
  '[data-test="@web/CartIcon"]',
  '[data-test="cart-count"]',
  '[data-test="cartCount"]',
  'a[href*="/cart"] [data-test="@web/CartLinkQuantity"]',
  'a[href*="/cart"]',
  'a[aria-label*="cart" i]',
];

const ADDED_TO_CART_PATTERNS = [
  /added to (?:your )?cart/i,
  /item added/i,
  /\d+\s+in\s+cart/i,
];

const CART_ARIA_COUNT = /cart\s+(\d+)\s+items?/i;

function elementCountText(el: Element): string {
  const parts = [el.textContent, el.getAttribute("aria-label")].filter(
    (value) => value != null && value.trim() !== "",
  );
  return parts.join(" ");
}

export function parseCartCount(text: string): number | null {
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

export function hasCartAddSuccessUi(doc: Document): boolean {
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
