/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  isRestockWaitPage,
  waitingForAddToCartStatus,
} from "@ext/domains/target/lib/restock-wait.ts";

const DROP_OOS_URL = "https://www.target.com/p/-/A-1011209279";
const IN_STOCK_URL = "https://www.target.com/p/scotch-tape/-/A-13356914";

describe("restock-wait", () => {
  it("detects drop-OOS PDP with NonbuyableSection and no fulfillment tabs", () => {
    document.body.innerHTML = `
      <div data-test="NonbuyableSection"></div>
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button id="addToCartButtonOrTextIdFor1011209279" type="button" disabled>Add to cart</button>
      </div>
    `;

    expect(isRestockWaitPage(document, DROP_OOS_URL)).toBe(true);
    expect(waitingForAddToCartStatus(document, DROP_OOS_URL)).toBe("Waiting for restock…");
  });

  it("detects restock wait via outOfStockMessage", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <div data-test="outOfStockMessage">Out of stock</div>
        <button id="addToCartButtonOrTextIdFor1011209279" type="button" disabled>Add to cart</button>
      </div>
      <button data-test="fulfillment-cell-shipping" type="button">Shipping</button>
    `;

    expect(isRestockWaitPage(document, DROP_OOS_URL)).toBe(true);
  });

  it("returns generic wait status on in-stock PDP with fulfillment tabs", () => {
    document.body.innerHTML = `
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button id="addToCartButtonOrTextIdFor13356914" type="button">Add to cart</button>
      </div>
      <button data-test="fulfillment-cell-shipping" type="button">Shipping</button>
      <button data-test="fulfillment-cell-pickup" type="button">Pickup</button>
    `;

    expect(isRestockWaitPage(document, IN_STOCK_URL)).toBe(false);
    expect(waitingForAddToCartStatus(document, IN_STOCK_URL)).toBe(
      "Waiting for main Add to cart…",
    );
  });

  it("returns false when page TCIN button is missing", () => {
    document.body.innerHTML = `
      <div data-test="NonbuyableSection"></div>
    `;

    expect(isRestockWaitPage(document, DROP_OOS_URL)).toBe(false);
  });
});
