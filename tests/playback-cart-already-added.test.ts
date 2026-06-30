/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";

import { runAutomationPlayback } from "@ext/content/retailer/automation/playback.ts";
import { CHECKOUT_START_URL, defaultTargetAutomationSteps } from "@ext/lib/retailer/playback-engine.ts";

describe("runAutomationPlayback cartAlreadyAdded", () => {
  it("skips add-to-cart steps and navigates to checkout", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });

    const result = await runAutomationPlayback(
      defaultTargetAutomationSteps(),
      () => {},
      {
        shouldContinue: () => true,
        refreshIntervalSec: 0,
        requestHardReload: async () => {},
        frontendAtcEnabled: true,
        backendAtcEnabled: false,
        cartAlreadyAdded: true,
        getEffectiveQuantity: () => 1,
      },
    );

    expect(result).toEqual({ ok: true });
    expect(assign).toHaveBeenCalledWith(CHECKOUT_START_URL);
  });
});
