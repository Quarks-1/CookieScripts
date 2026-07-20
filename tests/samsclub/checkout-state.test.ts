/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import { resolveCheckoutState } from "@ext/domains/samsclub/lib/checkout/checkout-state.ts";

describe("samsclub checkout-state", () => {
  it("detects review-order shell via place-order button", () => {
    document.body.innerHTML = `
      <button data-automation-id="place-order-button" data-testid="place-order-button">
        Place order
      </button>
    `;

    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
        document,
      ),
    ).toBe("needs_cvv");
  });

  it("detects thankyou as success", () => {
    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/thankyou?pcid=pc-test&orderId=10441315831",
        document,
      ),
    ).toBe("success");
  });

  it("stays in loading_or_error while checkout skeleton is visible", () => {
    document.body.innerHTML = `
      <div data-testid="checkout-container"></div>
      <div data-test="checkout-loading-skeleton"></div>
      <div data-test="spinnerOverlayContainer" data-visible="true"></div>
      <button data-automation-id="place-order-button">Place order</button>
    `;

    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
        document,
      ),
    ).toBe("loading_or_error");
  });

  it("returns needs_cvv when form errors are shown with cvv prompt", () => {
    document.body.innerHTML = `
      <div role="alert">Please correct the errors below.</div>
      <label>CVV (required)</label>
      <input id="cvv-field" type="password" maxlength="3" value="" />
      <button data-automation-id="place-order-button">Place order</button>
    `;

    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
        document,
      ),
    ).toBe("needs_cvv");
  });
});
