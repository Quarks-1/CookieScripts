/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activateElement, queryActionable } from "@ext/domains/target/lib/dom.ts";

describe("retailer dom", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 40,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  it("finds actionable buttons by selector", () => {
    document.body.innerHTML = `
      <button data-test="addToCartButton" type="button">Add to cart</button>
    `;
    const button = queryActionable(['[data-test="addToCartButton"]']);
    expect(button?.textContent).toBe("Add to cart");
  });

  it("activates elements with pointer and click events", () => {
    document.body.innerHTML = `<button id="btn">Add to cart</button>`;
    const button = document.getElementById("btn") as HTMLButtonElement;
    let clicks = 0;
    button.addEventListener("click", () => {
      clicks += 1;
    });
    activateElement(button);
    expect(clicks).toBe(1);
  });
});
