/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAutomationPlayback } from "@ext/content/retailer/automation/playback.ts";
import {
  readRetailerAutoResume,
  saveRetailerAutoResume,
  startRetailerAutoResume,
} from "@ext/lib/retailer/auto-resume.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/lib/retailer/selectors.ts";
import type { AutomationStep } from "@ext/types/retailer.ts";

const PAGE_URL = "https://www.target.com/p/restockr/-/A-95267143";

const addToCartOnlySteps = (): AutomationStep[] => [
  {
    type: "keyboard_enter_hold",
    selectors: [...DEFAULT_ADD_TO_CART_SELECTORS],
    holdMs: 400,
  },
];

describe("runAutomationPlayback failure modal refresh", () => {
  beforeEach(() => {
    sessionStorage.clear();
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

    document.body.innerHTML = `
      <div role="dialog">
        <h2>Item not added to cart</h2>
        <button aria-label="close" type="button">X</button>
      </div>
    `;
  });

  it("hard refreshes during failure-modal loop when refresh interval has elapsed", async () => {
    startRetailerAutoResume("manual", PAGE_URL);
    const resume = readRetailerAutoResume();
    expect(resume).not.toBeNull();
    saveRetailerAutoResume({
      ...resume!,
      last_refresh_at: Date.now() - 5_000,
    });

    const requestHardReload = vi.fn(async () => {});

    const result = await runAutomationPlayback(addToCartOnlySteps(), () => {}, {
      shouldContinue: () => true,
      refreshIntervalSec: 3,
      requestHardReload,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      getEffectiveQuantity: () => 1,
    });

    expect(requestHardReload).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: false, error: "Reloading" });
  });

  it("keeps dismissing without refresh while interval has not elapsed", async () => {
    startRetailerAutoResume("manual", PAGE_URL);

    const requestHardReload = vi.fn(async () => {});
    let iterations = 0;
    const shouldContinue = () => {
      iterations += 1;
      return iterations < 5;
    };

    await runAutomationPlayback(addToCartOnlySteps(), () => {}, {
      shouldContinue,
      refreshIntervalSec: 60,
      requestHardReload,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      getEffectiveQuantity: () => 1,
    });

    expect(requestHardReload).not.toHaveBeenCalled();
  });
});
