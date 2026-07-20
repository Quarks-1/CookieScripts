/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  isCheckoutAutomationUrl,
  isCheckoutHandoffTransitUrl,
  isCheckoutHardErrorPage,
  isCheckoutPageLoading,
  isOrderConfirmationUrl,
  isSamsclubReviewOrderUrl,
  readySamsclubAutoModeMessage,
} from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";

describe("samsclub checkout-url", () => {
  it("uses checkout-ready message on review-order", () => {
    expect(
      readySamsclubAutoModeMessage(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
      ),
    ).toBe("Ready — press Start Auto Mode");
  });

  it("detects review-order checkout path", () => {
    expect(
      isSamsclubReviewOrderUrl(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
      ),
    ).toBe(true);
    expect(isSamsclubReviewOrderUrl("https://www.samsclub.com/checkout/shipping")).toBe(
      false,
    );
  });

  it("treats cart and pac as checkout handoff transit urls", () => {
    expect(isCheckoutHandoffTransitUrl("https://www.samsclub.com/cart")).toBe(true);
    expect(isCheckoutHandoffTransitUrl("https://www.samsclub.com/pac")).toBe(true);
    expect(
      isCheckoutHandoffTransitUrl(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
      ),
    ).toBe(false);
  });

  it("treats thankyou as order confirmation", () => {
    expect(
      isOrderConfirmationUrl(
        "https://www.samsclub.com/thankyou?pcid=pc-test&orderId=10441315831",
      ),
    ).toBe(true);
  });

  it("still accepts order-confirmation paths", () => {
    expect(isOrderConfirmationUrl("https://www.samsclub.com/order-confirmation/1")).toBe(
      true,
    );
  });

  it("includes thankyou in checkout automation urls", () => {
    expect(
      isCheckoutAutomationUrl(
        "https://www.samsclub.com/thankyou?orderId=10441315831",
      ),
    ).toBe(true);
  });

  it("treats bare loading skeleton as page loading, not hard error", () => {
    document.body.innerHTML = '<div data-test="checkout-loading-skeleton"></div>';
    expect(isCheckoutPageLoading(document)).toBe(true);
    expect(isCheckoutHardErrorPage(document)).toBe(false);
  });

  it("detects checkout page loading from skeleton or spinner", () => {
    document.body.innerHTML = `
      <div data-testid="checkout-container"></div>
      <div data-test="checkout-loading-skeleton"></div>
    `;
    expect(isCheckoutPageLoading(document)).toBe(true);
    expect(isCheckoutHardErrorPage(document)).toBe(false);
  });

  it("ignores loading skeleton and spinner while page is still loading", () => {
    document.body.innerHTML = `
      <div data-testid="checkout-container"></div>
      <div data-test="checkout-loading-skeleton"></div>
      <div data-test="spinnerOverlayContainer" data-visible="true"></div>
    `;
    expect(isCheckoutPageLoading(document)).toBe(true);
    expect(isCheckoutHardErrorPage(document)).toBe(false);
  });

  it("still treats unavailable copy as hard error after shell loads", () => {
    document.body.innerHTML = `
      <div data-testid="checkout-container"></div>
      <p>We're sorry! This page is currently unavailable. Please try again later.</p>
    `;
    expect(isCheckoutHardErrorPage(document)).toBe(true);
  });
});
