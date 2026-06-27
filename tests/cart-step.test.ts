/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  cartCountIncreased,
  parseCartCount,
  readCartCountFromDocument,
} from "@ext/lib/retailer/cart-step.ts";

describe("cart-step", () => {
  it("parses cart counts from text", () => {
    expect(parseCartCount("3 items")).toBe(3);
    expect(parseCartCount("Cart")).toBeNull();
  });

  it("detects cart count increases", () => {
    expect(cartCountIncreased(0, 1, 1)).toBe(true);
    expect(cartCountIncreased(2, 2, 1)).toBe(false);
  });

  it("reads cart count from fixture dom", () => {
    document.body.innerHTML = `
      <a data-test="@web/CartLink" aria-label="cart">
        <span>2</span>
      </a>
    `;
    expect(readCartCountFromDocument(document)).toBe(2);
  });
});
