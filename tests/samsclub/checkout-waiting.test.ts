/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  markCheckoutProgress,
  saveSamsclubAutoResume,
} from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  readCheckoutProgressSnapshot,
  runCheckoutWaitingTick,
} from "@ext/domains/samsclub/lib/checkout/waiting-checkout.ts";

describe("samsclub waiting-checkout", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not stall-refresh immediately after checkout page load resets progress", async () => {
    const pageLoadAt = new Date("2024-01-01T00:01:00Z");
    vi.setSystemTime(pageLoadAt);

    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/foo/123",
      phase: "checkout",
      auto_checkout_enabled: true,
      last_refresh_at: 1,
      last_checkout_progress_at: 1,
    });

    // Simulates runCheckoutAutoMode entry after hard reload.
    markCheckoutProgress();

    document.body.innerHTML = `
      <input id="cvv-field" type="password" maxlength="3" value="" />
      <button data-automation-id="place-order-button" disabled>Place order</button>
    `;

    const enteredAt = pageLoadAt.getTime();
    vi.setSystemTime(new Date(enteredAt + 2_000));

    const requestHardReload = vi.fn(async () => {});
    const result = await runCheckoutWaitingTick({
      refreshIntervalSec: 3,
      shouldContinue: () => true,
      requestHardReload,
      progressSnapshot: readCheckoutProgressSnapshot(document),
      checkoutEnteredAtMs: enteredAt,
    });

    expect(result.kind).toBe("continue");
    expect(requestHardReload).not.toHaveBeenCalled();
  });
});
