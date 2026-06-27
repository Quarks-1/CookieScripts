const CART_COUNT_SELECTORS = [
  '[data-test="@web/CartLink"] span',
  '[data-test="cart-count"]',
  'a[aria-label*="cart" i] span',
];

export function parseCartCount(text: string): number | null {
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
    if (!el?.textContent) {
      continue;
    }
    const count = parseCartCount(el.textContent);
    if (count !== null) {
      return count;
    }
  }
  return 0;
}

export function hasCartSuccessLiveRegion(doc: Document): boolean {
  const regions = doc.querySelectorAll('[aria-live="polite"], [role="status"]');
  for (const region of regions) {
    const text = region.textContent?.toLowerCase() ?? "";
    if (text.includes("added") && text.includes("cart")) {
      return true;
    }
  }
  return false;
}

export function cartCountIncreased(before: number, after: number, minDelta: number): boolean {
  return after - before >= minDelta;
}
