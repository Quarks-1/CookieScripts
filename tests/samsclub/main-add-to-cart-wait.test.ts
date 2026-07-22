/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, afterEach } from "vitest";

import { saveSamsclubAutoResume } from "@ext/domains/samsclub/lib/auto-resume.ts";
import { waitForMainAddToCartButton } from "@ext/domains/samsclub/lib/main-add-to-cart.ts";

describe("samsclub waitForMainAddToCartButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hard refreshes when no buy-box ATC exists yet", async () => {
    vi.useFakeTimers();

    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/Rattle/20186272756",
      phase: "pdp",
      auto_checkout_enabled: false,
      last_refresh_at: Date.now() - 5_000,
      last_checkout_progress_at: Date.now() - 5_000,
    });

    document.body.innerHTML = `
      <main>
        <button type="button">Shop similar</button>
        <p>Drops July 21st</p>
        <p>Not available</p>
      </main>
    `;

    const requestHardReload = vi.fn(async () => {});
    const pageUrl = "https://www.samsclub.com/ip/Rattle/20186272756";

    const waitPromise = waitForMainAddToCartButton({
      selectors: ['button[data-automation-id="atc"]'],
      timeoutMs: null,
      shouldContinue: () => true,
      pageUrl,
      refreshIntervalSec: 3,
      requestHardReload,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
    });

    await vi.advanceTimersByTimeAsync(400);
    await waitPromise;

    expect(requestHardReload).toHaveBeenCalledTimes(1);
  });

  it("hard refreshes on throttle page copy", async () => {
    vi.useFakeTimers();

    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/Rattle/20186272756",
      phase: "pdp",
      auto_checkout_enabled: false,
      last_refresh_at: Date.now() - 5_000,
      last_checkout_progress_at: Date.now() - 5_000,
    });

    document.body.innerHTML = `
      <main>
        <h1>Hold tight for a moment</h1>
        <p>Please wait - SamsClub.com</p>
      </main>
    `;

    const requestHardReload = vi.fn(async () => {});
    const pageUrl = "https://www.samsclub.com/ip/Rattle/20186272756";

    const waitPromise = waitForMainAddToCartButton({
      selectors: ['button[data-automation-id="atc"]'],
      timeoutMs: null,
      shouldContinue: () => true,
      pageUrl,
      refreshIntervalSec: 3,
      requestHardReload,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
    });

    await vi.advanceTimersByTimeAsync(400);
    await waitPromise;

    expect(requestHardReload).toHaveBeenCalledTimes(1);
  });
});
