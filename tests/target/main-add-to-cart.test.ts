/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findMainAddToCartButton,
  mainAddToCartButtonId,
  parseTargetTcinFromUrl,
  resolveMainAddToCartWaitState,
} from "@ext/domains/target/lib/main-add-to-cart.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/domains/target/lib/selectors.ts";

const PAGE_URL =
  "https://www.target.com/p/restockr/-/A-1011209279?nrtv_cid=vt3w5xhj28kwr";

describe("main-add-to-cart", () => {
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

  it("parses TCIN from Target product urls", () => {
    expect(parseTargetTcinFromUrl(PAGE_URL)).toBe("1011209279");
    expect(mainAddToCartButtonId("1011209279")).toBe("addToCartButtonOrTextIdFor1011209279");
  });

  it("prefers the main fulfillment button for the page TCIN", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button
          data-test="shippingButton"
          id="addToCartButtonOrTextIdFor1011209279"
          type="button"
        >Add to cart</button>
      </div>
      <div data-test="addToCartSuccessModalRecommendations">
        <button data-test="chooseOptionsButton" type="button">Add to cart</button>
      </div>
    `;

    const button = findMainAddToCartButton(['button[data-test="shippingButton"]'], {
      pageUrl: PAGE_URL,
    });

    expect(button?.id).toBe("addToCartButtonOrTextIdFor1011209279");
    expect(button?.getAttribute("data-test")).toBe("shippingButton");
  });

  it("finds the main button by TCIN id without data-test", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button
          id="addToCartButtonOrTextIdFor1011209279"
          type="button"
          aria-label="Add to cart for Pokémon Trading Card Game"
        >Add to cart</button>
      </div>
    `;

    const button = findMainAddToCartButton(DEFAULT_ADD_TO_CART_SELECTORS, {
      pageUrl: PAGE_URL,
    });

    expect(button?.id).toBe("addToCartButtonOrTextIdFor1011209279");
    expect(button?.getAttribute("data-test")).toBeNull();
  });

  it("ignores enabled recommendation buttons when the main button is disabled", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button
          data-test="shippingButton"
          id="addToCartButtonOrTextIdFor1011209279"
          type="button"
          disabled
        >Add to cart</button>
      </div>
      <div data-test="addToCartSuccessModalRecommendations">
        <button data-test="chooseOptionsButton" type="button">Add to cart</button>
      </div>
    `;

    const button = findMainAddToCartButton(['button[data-test="shippingButton"]'], {
      pageUrl: PAGE_URL,
      requireActionable: true,
    });

    expect(button).toBeNull();
  });

  it("reports waiting when the TCIN main button is disabled", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button
          id="addToCartButtonOrTextIdFor1011209279"
          type="button"
          disabled
        >Add to cart</button>
      </div>
      <div data-test="addToCartSuccessModalRecommendations">
        <button data-test="chooseOptionsButton" type="button">Add to cart</button>
      </div>
    `;

    const state = resolveMainAddToCartWaitState(DEFAULT_ADD_TO_CART_SELECTORS, PAGE_URL);
    expect(state.kind).toBe("waiting_disabled");
    expect(state.kind === "waiting_disabled" && state.element.id).toBe(
      "addToCartButtonOrTextIdFor1011209279",
    );
  });

  it("ignores sticky Find alternative button", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button
          id="addToCartButtonOrTextIdFor1011209279"
          type="button"
          disabled
        >Add to cart</button>
      </div>
      <div data-test="StickyAddToCartFulfillmentSection">
        <button type="button">Find alternative</button>
      </div>
    `;

    const button = findMainAddToCartButton(DEFAULT_ADD_TO_CART_SELECTORS, {
      pageUrl: PAGE_URL,
      requireActionable: true,
    });

    expect(button).toBeNull();
  });

  it("excludes showInStockPrimaryButton in fulfillment scope", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button data-test="showInStockPrimaryButton" type="button">Show in stock</button>
        <button
          id="addToCartButtonOrTextIdFor1011209279"
          type="button"
        >Add to cart</button>
      </div>
    `;

    const button = findMainAddToCartButton(DEFAULT_ADD_TO_CART_SELECTORS, {
      pageUrl: PAGE_URL,
    });

    expect(button?.id).toBe("addToCartButtonOrTextIdFor1011209279");
  });

  it("finds actionable TCIN button in sticky scope", () => {
    document.body.innerHTML = `
      <div data-test="StickyAddToCartFulfillmentSection">
        <button type="button">Find alternative</button>
        <button
          id="addToCartButtonOrTextIdFor1011209279"
          type="button"
        >Add to cart</button>
      </div>
    `;

    const button = findMainAddToCartButton(DEFAULT_ADD_TO_CART_SELECTORS, {
      pageUrl: PAGE_URL,
    });

    expect(button?.id).toBe("addToCartButtonOrTextIdFor1011209279");
  });
});
