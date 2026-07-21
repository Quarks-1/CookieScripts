/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForMainAddToCartButton } from "@ext/domains/target/lib/main-add-to-cart.ts";

const DROP_OOS_URL = "https://www.target.com/p/-/A-1011209279";

describe("waitForMainAddToCartButton OOS debounce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onOosConfirmed after two consecutive OOS ticks when stop is enabled", async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <div data-test="NonbuyableSection"></div>
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button id="addToCartButtonOrTextIdFor1011209279" type="button" disabled>Add to cart</button>
      </div>
    `;

    const onOosConfirmed = vi.fn();
    const waitPromise = waitForMainAddToCartButton({
      selectors: ['[data-test="addToCartButton"]'],
      timeoutMs: null,
      shouldContinue: () => true,
      pageUrl: DROP_OOS_URL,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      stopOnOosEnabled: true,
      onOosConfirmed,
    });

    await vi.advanceTimersByTimeAsync(450);
    const result = await waitPromise;

    expect(result).toBeNull();
    expect(onOosConfirmed).toHaveBeenCalledTimes(1);
  });

  it("does not call onOosConfirmed when OOS toggles are off", async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <div data-test="NonbuyableSection"></div>
      <div data-test="@web/AddToCart/FulfillmentSection">
        <button id="addToCartButtonOrTextIdFor1011209279" type="button" disabled>Add to cart</button>
      </div>
    `;

    const onOosConfirmed = vi.fn();
    const waitPromise = waitForMainAddToCartButton({
      selectors: ['[data-test="addToCartButton"]'],
      timeoutMs: 500,
      shouldContinue: () => true,
      pageUrl: DROP_OOS_URL,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      stopOnOosEnabled: false,
      closeTabOnOosEnabled: false,
      onOosConfirmed,
    });

    await vi.advanceTimersByTimeAsync(600);
    const result = await waitPromise;

    expect(result).toBeNull();
    expect(onOosConfirmed).not.toHaveBeenCalled();
  });
});
