/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  isCheckoutAuthRequiredPage,
  isCheckoutAutomationUrl,
  isCheckoutHardErrorPage,
  isOrderConfirmationUrl,
  isRetailerCheckoutUrl,
} from "@ext/domains/target/lib/checkout/checkout-url.ts";

describe("checkout-url", () => {
  it("detects checkout URLs", () => {
    expect(isRetailerCheckoutUrl("https://www.target.com/checkout")).toBe(true);
    expect(isRetailerCheckoutUrl("https://www.target.com/checkout/start")).toBe(true);
    expect(isRetailerCheckoutUrl("https://www.target.com/p/foo/-/A-1")).toBe(false);
  });

  it("detects order confirmation URLs", () => {
    expect(isOrderConfirmationUrl("https://www.target.com/order-confirmation")).toBe(true);
    expect(isOrderConfirmationUrl("https://www.target.com/order-confirmation/12345")).toBe(true);
  });

  it("isCheckoutAutomationUrl covers checkout and confirmation", () => {
    expect(isCheckoutAutomationUrl("https://www.target.com/checkout/start")).toBe(true);
    expect(isCheckoutAutomationUrl("https://www.target.com/order-confirmation/1")).toBe(true);
    expect(isCheckoutAutomationUrl("https://www.target.com/p/foo/-/A-1")).toBe(false);
  });

  it("detects auth flyout separately from generic hard errors", () => {
    document.body.innerHTML =
      '<div data-test="@web/auth-components/AuthSignInFlyout"></div>';
    expect(isCheckoutAuthRequiredPage(document)).toBe(true);
    expect(isCheckoutHardErrorPage(document)).toBe(false);
  });

  it("detects hard error copy without auth flyout", () => {
    document.body.textContent =
      "We're sorry! This page is currently unavailable. Please try again later.";
    expect(isCheckoutAuthRequiredPage(document)).toBe(false);
    expect(isCheckoutHardErrorPage(document)).toBe(true);
  });
});
