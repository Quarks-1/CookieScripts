import { describe, expect, it, vi } from "vitest";

import { retryUntilConfirmed } from "@ext/lib/retailer/cart-retry.ts";

describe("retryUntilConfirmed", () => {
  it("retries tryAction until isConfirmed returns true", async () => {
    vi.useFakeTimers();
    let confirmed = false;
    const tryAction = vi.fn(async () => {
      if (tryAction.mock.calls.length >= 3) {
        confirmed = true;
      }
    });

    const promise = retryUntilConfirmed({
      retryIntervalMs: 10,
      shouldContinue: () => true,
      isConfirmed: () => confirmed,
      tryAction,
    });

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("confirmed");
    expect(tryAction.mock.calls.length).toBeGreaterThanOrEqual(3);

    vi.useRealTimers();
  });

  it("aborts when shouldContinue returns false", async () => {
    vi.useFakeTimers();
    const tryAction = vi.fn(async () => {});
    let active = true;

    const promise = retryUntilConfirmed({
      retryIntervalMs: 10,
      shouldContinue: () => active,
      isConfirmed: () => false,
      tryAction,
    });

    active = false;
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("aborted");
    expect(tryAction.mock.calls.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
