/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";

import { clearSamsclubAutoResume, saveSamsclubAutoResume } from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  shouldRunTransitThrottleWatch,
  stopTransitThrottleWatch,
} from "@ext/domains/samsclub/content/session/transit-wait.ts";

describe("transit throttle watch", () => {
  afterEach(() => {
    stopTransitThrottleWatch();
    clearSamsclubAutoResume();
  });

  it("runs watch only on checkout handoff transit urls", () => {
    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/foo/123",
      phase: "checkout",
      auto_checkout_enabled: true,
      last_refresh_at: Date.now(),
      last_checkout_progress_at: Date.now(),
    });

    expect(shouldRunTransitThrottleWatch("https://www.samsclub.com/cart")).toBe(true);
    expect(shouldRunTransitThrottleWatch("https://www.samsclub.com/pac")).toBe(true);
    expect(shouldRunTransitThrottleWatch("https://www.samsclub.com/checkout/review-order")).toBe(
      false,
    );
  });

  it("does not run without checkout resume", () => {
    expect(shouldRunTransitThrottleWatch("https://www.samsclub.com/cart")).toBe(false);
  });
});
