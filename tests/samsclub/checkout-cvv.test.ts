/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  blurCheckoutCvvField,
  fillCheckoutCvvInput,
  findCheckoutCvvInput,
  hasCheckoutCvvValidationError,
  hasCheckoutFormErrors,
  isCheckoutCvvBlurred,
  isCheckoutCvvPromptVisible,
  isCheckoutCvvRequired,
  isCheckoutCvvSatisfied,
  canSafelyPlaceOrder,
  POST_CVV_STABLE_POLLS_REQUIRED,
  tryFillCheckoutCvv,
  waitForPostCvvCheckoutReady,
} from "@ext/domains/samsclub/lib/checkout/cvv.ts";
import { resolveCheckoutState } from "@ext/domains/samsclub/lib/checkout/checkout-state.ts";

describe("samsclub checkout cvv", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finds cvv input by id or name", () => {
    document.body.innerHTML = `<input id="cvv-field" type="password" maxlength="3" />`;
    expect(findCheckoutCvvInput(document)?.id).toBe("cvv-field");

    document.body.innerHTML = `<input name="cvv" type="password" maxlength="3" />`;
    expect(findCheckoutCvvInput(document)?.name).toBe("cvv");
  });

  it("skips hidden cvv inputs and selects the visible field", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValueOnce({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect)
      .mockReturnValue({
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

    document.body.innerHTML = `
      <input name="cvv" type="password" maxlength="3" value="" />
      <input id="cvv-field" type="password" maxlength="3" value="" />
    `;
    expect(findCheckoutCvvInput(document)?.id).toBe("cvv-field");
  });

  it("treats missing cvv field as satisfied on non-review checkout steps", () => {
    document.body.innerHTML = "";
    const shippingUrl = "https://www.samsclub.com/checkout/shipping";
    expect(isCheckoutCvvSatisfied(document, shippingUrl)).toBe(true);
    expect(isCheckoutCvvRequired(document, shippingUrl)).toBe(false);
  });

  it("treats missing cvv field as unsatisfied on review-order", () => {
    document.body.innerHTML = `
      <button data-automation-id="place-order-button">Place order</button>
    `;
    const reviewUrl = "https://www.samsclub.com/checkout/review-order?cartId=ca-test";
    expect(isCheckoutCvvSatisfied(document, reviewUrl)).toBe(false);
    expect(isCheckoutCvvRequired(document, reviewUrl)).toBe(true);
    expect(canSafelyPlaceOrder(document, reviewUrl)).toBe(false);
    expect(
      resolveCheckoutState(reviewUrl, document),
    ).toBe("needs_cvv");
  });

  it("requires three digits when cvv field is visible", async () => {
    document.body.innerHTML = `<input id="cvv-field" type="password" maxlength="3" value="" />`;
    expect(isCheckoutCvvRequired(document)).toBe(true);
    expect(isCheckoutCvvSatisfied(document)).toBe(false);

    const input = findCheckoutCvvInput(document);
    expect(input).not.toBeNull();
    const fillPromise = fillCheckoutCvvInput(input!, "123", 0);
    await vi.runAllTimersAsync();
    await fillPromise;
    expect(isCheckoutCvvSatisfied(document)).toBe(true);
    expect(isCheckoutCvvRequired(document)).toBe(false);
  });

  it("fills cvv via simulated typing and input events", async () => {
    document.body.innerHTML = `<input id="cvv-field" type="password" maxlength="3" value="" />`;
    const input = findCheckoutCvvInput(document)!;
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));

    const fillPromise = tryFillCheckoutCvv("456", document);
    await vi.runAllTimersAsync();
    expect(await fillPromise).toBe("filled");
    expect(input.value).toBe("456");
    expect(events.filter((event) => event === "input").length).toBeGreaterThan(0);
    expect(events).toContain("change");
  });

  it("rejects invalid cvv", async () => {
    document.body.innerHTML = `<input id="cvv-field" type="password" maxlength="3" value="" />`;
    expect(await tryFillCheckoutCvv("12", document)).toBe("invalid_cvv");
    expect(await tryFillCheckoutCvv(null, document)).toBe("invalid_cvv");
  });

  it("returns already_set when value matches and place order is enabled", async () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="789" />
      <button data-automation-id="place-order-button">Place order</button>
    `;
    expect(await tryFillCheckoutCvv("789", document)).toBe("already_set");
  });

  it("returns pending_validation when dom value matches but checkout is not satisfied", async () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="789" />
      <button data-automation-id="place-order-button" disabled>Place order</button>
      <div role="alert">Please correct the errors below.</div>
    `;
    expect(
      await tryFillCheckoutCvv(
        "789",
        document,
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
      ),
    ).toBe("pending_validation");
  });

  it("re-fills when dom value does not match target cvv", async () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="111" />
      <button data-automation-id="place-order-button" disabled>Place order</button>
    `;
    const fillPromise = tryFillCheckoutCvv("789", document);
    await vi.runAllTimersAsync();
    expect(await fillPromise).toBe("filled");
  });

  it("detects visible cvv validation errors", () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="123" aria-invalid="true" />
      <div role="alert">Enter the 3 digit code on the back of your card.</div>
    `;
    expect(hasCheckoutCvvValidationError(document)).toBe(true);
    expect(isCheckoutCvvSatisfied(document)).toBe(false);
    expect(isCheckoutCvvRequired(document)).toBe(true);
  });

  it("re-fills when dom value does not match despite validation error", async () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="111" aria-invalid="true" />
      <button data-automation-id="place-order-button">Place order</button>
      <div role="alert">Enter the 3 digit code on the back of your card.</div>
    `;
    const fillPromise = tryFillCheckoutCvv("789", document);
    await vi.runAllTimersAsync();
    expect(await fillPromise).toBe("filled");
  });

  it("treats cvv prompt without matched input as unsatisfied", () => {
    document.body.innerHTML = `
      <label>CVV (required)</label>
      <button data-automation-id="place-order-button">Place order</button>
    `;
    expect(isCheckoutCvvPromptVisible(document)).toBe(true);
    expect(isCheckoutCvvSatisfied(document)).toBe(false);
    expect(isCheckoutCvvRequired(document)).toBe(true);
    expect(canSafelyPlaceOrder(document)).toBe(false);
  });

  it("detects checkout form error banner", () => {
    document.body.innerHTML = `
      <div role="alert">Please correct the errors below.</div>
      <label>CVV (required)</label>
      <input id="cvv-field" type="password" maxlength="3" value="" />
      <button data-automation-id="place-order-button">Place order</button>
    `;
    expect(hasCheckoutFormErrors(document)).toBe(true);
    expect(canSafelyPlaceOrder(document)).toBe(false);
  });

  it("treats focused cvv as blurred after blur helper runs", () => {
    const reviewUrl = "https://www.samsclub.com/checkout/review-order?cartId=ca-test";
    document.body.innerHTML = `<input id="cvv-field" type="password" maxlength="3" value="123" />`;
    const input = findCheckoutCvvInput(document)!;
    input.focus();
    expect(isCheckoutCvvBlurred(document)).toBe(false);
    expect(isCheckoutCvvSatisfied(document, reviewUrl)).toBe(true);
    blurCheckoutCvvField(document);
    expect(isCheckoutCvvBlurred(document)).toBe(true);
    expect(canSafelyPlaceOrder(document, reviewUrl)).toBe(false);
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="123" />
      <button data-automation-id="place-order-button">Place order</button>
    `;
    expect(canSafelyPlaceOrder(document, reviewUrl)).toBe(true);
  });

  it("waits for stable cvv polls before post-cvv ready", async () => {
    const reviewUrl = "https://www.samsclub.com/checkout/review-order?cartId=ca-test";
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="123" />
      <button data-automation-id="place-order-button">Place order</button>
    `;

    const readyPromise = waitForPostCvvCheckoutReady(
      document,
      5_000,
      reviewUrl,
      3,
    );
    await vi.advanceTimersByTimeAsync(POST_CVV_STABLE_POLLS_REQUIRED * 50);
    await expect(readyPromise).resolves.toBe(true);
  });
});

describe("samsclub checkout-state with cvv", () => {
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

  it("returns needs_cvv when place order is disabled and cvv is empty", () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="" />
      <button data-automation-id="place-order-button" disabled>Place order</button>
    `;

    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
        document,
      ),
    ).toBe("needs_cvv");
  });

  it("returns ready_to_place when cvv is filled and place order is enabled", () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="123" />
      <button data-automation-id="place-order-button">Place order</button>
    `;

    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
        document,
      ),
    ).toBe("ready_to_place");
  });

  it("returns needs_cvv when dom value is set but place order stays disabled", () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="123" />
      <button data-automation-id="place-order-button" disabled>Place order</button>
    `;

    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
        document,
      ),
    ).toBe("needs_cvv");
  });

  it("returns needs_cvv when validation error is visible even if place order is enabled", () => {
    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="123" aria-invalid="true" />
      <button data-automation-id="place-order-button">Place order</button>
      <div role="alert">Enter the 3 digit code on the back of your card.</div>
    `;

    expect(
      resolveCheckoutState(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
        document,
      ),
    ).toBe("needs_cvv");
  });
});
