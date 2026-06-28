/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  cartCountIncreased,
  hasCartAddSuccessUi,
  isCartConfirmed,
  parseCartCount,
  readCartCountFromDocument,
} from "@ext/lib/retailer/cart-step.ts";

describe("cart-step", () => {
  it("parses cart counts from text and aria-label", () => {
    expect(parseCartCount("3 items")).toBe(3);
    expect(parseCartCount("cart 0 items")).toBe(0);
    expect(parseCartCount("cart 1 item")).toBe(1);
    expect(parseCartCount("Cart")).toBeNull();
  });

  it("detects cart count increases", () => {
    expect(cartCountIncreased(0, 1, 1)).toBe(true);
    expect(cartCountIncreased(2, 2, 1)).toBe(false);
  });

  it("reads empty-cart count from aria-label when text is blank", () => {
    document.body.innerHTML = `
      <a data-test="@web/CartLink" aria-label="cart 0 items" href="/cart">
        <div data-test="@web/CartIcon"></div>
      </a>
    `;
    expect(readCartCountFromDocument(document)).toBe(0);
  });

  it("reads cart count from quantity badge", () => {
    document.body.innerHTML = `
      <a data-test="@web/CartLink" aria-label="cart 1 item" href="/cart">
        <span data-test="@web/CartLinkQuantity">1</span>
      </a>
    `;
    expect(readCartCountFromDocument(document)).toBe(1);
  });

  it("detects add-to-cart success modal and sticky in-cart state", () => {
    document.body.innerHTML = `
      <div data-test="addToCartSuccessModalRecommendations">Added</div>
      <div data-test="StickyAddToCartFulfillmentSection">1 in cart</div>
    `;
    expect(hasCartAddSuccessUi(document)).toBe(true);
    expect(isCartConfirmed(document, 0, 1)).toBe(true);
  });
});
