/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { hasCheckoutErrorModal } from "@ext/domains/target/lib/checkout/checkout-error-modal.ts";

function loadFixture(name: string): string {
  return readFileSync(resolve(import.meta.dirname, "../fixtures", name), "utf8");
}

function mountFixture(name: string): void {
  const html = loadFixture(name);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
}

describe("checkout-error-modal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects high-demand checkout error modal", () => {
    mountFixture("target-checkout-high-demand-modal.html");
    expect(hasCheckoutErrorModal(document)).toBe(true);
  });

  it("returns false on ready checkout fixture", () => {
    mountFixture("target-checkout-ready.html");
    expect(hasCheckoutErrorModal(document)).toBe(false);
  });

  it("returns false for unrelated dialog copy", () => {
    document.body.innerHTML = `
      <div role="dialog">
        <h2>Item not added to cart</h2>
        <span>Something went wrong and the item was not added to your cart. Please try again.</span>
      </div>
    `;
    expect(hasCheckoutErrorModal(document)).toBe(false);
  });

  it("returns false when high-demand copy is not inside a dialog", () => {
    document.body.innerHTML = `
      <main>
        <p>High-demand item in your cart. Please try again.</p>
      </main>
    `;
    expect(hasCheckoutErrorModal(document)).toBe(false);
  });
});
