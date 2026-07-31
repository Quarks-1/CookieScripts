/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  hasPositiveFulfillmentPath,
  isOosSignal,
  isRestockWaitPage,
  isTargetPdpHydrationPending,
  waitingForAddToCartStatus,
} from "@ext/domains/target/lib/restock-wait.ts";

const DROP_OOS_URL = "https://www.target.com/p/-/A-1011209279";
const DROP_OOS_URL_1011483408 =
  "https://www.target.com/p/restocks/-/A-1011483408";
const IN_STOCK_URL = "https://www.target.com/p/scotch-tape/-/A-13356914";

function dropOosFulfillmentHtml(tcin: string): string {
  return `
    <div data-test="@web/AddToCart/FulfillmentSection">
      <div data-test="NonbuyableSection">
        <span class="h-text-bold">Out of stock</span>
        <button id="addToCartButtonOrTextIdFor${tcin}" type="button" disabled>Add to cart</button>
      </div>
    </div>
  `;
}

describe("restock-wait", () => {
  it("detects drop-OOS PDP with NonbuyableSection and no fulfillment tabs", () => {
    document.body.innerHTML = dropOosFulfillmentHtml("1011209279");

    expect(isRestockWaitPage(document, DROP_OOS_URL)).toBe(true);
    expect(waitingForAddToCartStatus(document, DROP_OOS_URL)).toBe("Waiting for restock…");
  });

  it("detects live-shaped OOS for TCIN 1011483408", () => {
    document.body.innerHTML = dropOosFulfillmentHtml("1011483408");

    expect(isRestockWaitPage(document, DROP_OOS_URL_1011483408)).toBe(true);
  });

  it("detects restock wait via scoped outOfStockMessage with disabled main ATC", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <div data-test="outOfStockMessage">Out of stock</div>
        <button id="addToCartButtonOrTextIdFor1011209279" type="button" disabled>Add to cart</button>
      </div>
      <button data-test="fulfillment-cell-shipping" type="button">Shipping</button>
    `;

    expect(isRestockWaitPage(document, DROP_OOS_URL)).toBe(true);
  });

  it("does not treat store-only outOfStockMessage as product-wide OOS", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <div data-test="outOfStockMessage">Out of stock at Dulles</div>
        <button data-test="fulfillment-cell-pickup" type="button">PickupNot available</button>
        <button data-test="fulfillment-cell-shipping" type="button">ShippingArrives by Tue</button>
        <button id="addToCartButtonOrTextIdFor13356914" type="button">Add to cart</button>
      </div>
    `;

    expect(isRestockWaitPage(document, IN_STOCK_URL)).toBe(false);
    expect(hasPositiveFulfillmentPath(document, "13356914")).toBe(true);
  });

  it("returns generic wait status on in-stock PDP with fulfillment tabs", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button data-test="fulfillment-cell-shipping" type="button">ShippingArrives by Sun</button>
        <button id="addToCartButtonOrTextIdFor13356914" type="button">Add to cart</button>
      </div>
    `;

    expect(isRestockWaitPage(document, IN_STOCK_URL)).toBe(false);
    expect(waitingForAddToCartStatus(document, IN_STOCK_URL)).toBe(
      "Waiting for main Add to cart…",
    );
  });

  it("returns false when page TCIN button is missing (hydration pending)", () => {
    document.body.innerHTML = `
      <div data-test="NonbuyableSection"></div>
    `;

    expect(isTargetPdpHydrationPending(document, DROP_OOS_URL)).toBe(true);
    expect(isRestockWaitPage(document, DROP_OOS_URL)).toBe(false);
  });

  it("ignores page-wide NonbuyableSection outside main fulfillment scope", () => {
    document.body.innerHTML = `
      <div data-test="NonbuyableSection"></div>
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button data-test="fulfillment-cell-shipping" type="button">ShippingArrives by Sun</button>
        <button id="addToCartButtonOrTextIdFor13356914" type="button">Add to cart</button>
      </div>
    `;

    expect(isRestockWaitPage(document, IN_STOCK_URL)).toBe(false);
  });

  it("isOosSignal is true for restock wait DOM", () => {
    document.body.innerHTML = dropOosFulfillmentHtml("1011209279");

    expect(isOosSignal(document, DROP_OOS_URL)).toBe(true);
    expect(isOosSignal(document, DROP_OOS_URL, { kind: "out_of_stock" })).toBe(true);
    expect(isOosSignal(document, IN_STOCK_URL, { kind: "blocked" })).toBe(false);
  });
});
