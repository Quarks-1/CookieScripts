/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveCheckoutState } from "@ext/lib/retailer/checkout/checkout-state.ts";

function loadFixture(name: string): string {
  return readFileSync(resolve(import.meta.dirname, "fixtures", name), "utf8");
}

describe("checkout-state", () => {
  function mountFixture(name: string): void {
    const html = loadFixture(name);
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.body.innerHTML = parsed.body.innerHTML;
  }

  it("classifies drop-stuck fixture as mid_step", () => {
    mountFixture("target-checkout-drop-stuck.html");
    expect(resolveCheckoutState("https://www.target.com/checkout")).toBe("mid_step");
  });

  it("classifies ready fixture as ready_to_place", () => {
    mountFixture("target-checkout-ready.html");
    expect(resolveCheckoutState("https://www.target.com/checkout")).toBe("ready_to_place");
  });

  it("classifies order confirmation as success", () => {
    document.body.innerHTML = "";
    expect(resolveCheckoutState("https://www.target.com/order-confirmation/123")).toBe("success");
  });
});
