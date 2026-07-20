/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import { parseCartCount, hasCartAddSuccessUi } from "@ext/domains/samsclub/lib/cart-step.ts";

describe("samsclub cart-step", () => {
  it("parses Cart contains N item header aria", () => {
    expect(parseCartCount("Cart contains 2 items Total Amount $3.00")).toBe(2);
  });

  it("treats /pac as post-add success", () => {
    const doc = document.implementation.createHTMLDocument();
    Object.defineProperty(doc, "defaultView", {
      value: { location: { pathname: "/pac" } },
      configurable: true,
    });
    expect(hasCartAddSuccessUi(doc)).toBe(true);
  });
});
