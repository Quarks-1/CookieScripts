/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import { saveSamsclubAutoResume } from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  applyCachedAutoConfig,
  session,
  state,
} from "@ext/domains/samsclub/content/session/session-state.ts";

describe("samsclub session-state", () => {
  it("applies auto checkout from config when session is not running", () => {
    session.running = false;
    state.cachedAutoCheckoutEnabled = false;

    applyCachedAutoConfig({
      refreshIntervalSec: 0,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      atcQuantity: 1,
      useMaxQuantity: false,
      autoCheckoutEnabled: true,
      checkoutCvv: "123",
      stopOnOosEnabled: false,
    });

    expect(state.cachedAutoCheckoutEnabled).toBe(true);
    expect(state.cachedCheckoutCvv).toBe("123");
  });

  it("keeps auto checkout enabled when resuming checkout phase while running", () => {
    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/foo/123",
      phase: "checkout",
      auto_checkout_enabled: true,
      last_refresh_at: 1,
      last_checkout_progress_at: 1,
    });

    session.running = true;
    state.cachedAutoCheckoutEnabled = false;

    applyCachedAutoConfig({
      refreshIntervalSec: 0,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      atcQuantity: 1,
      useMaxQuantity: false,
      autoCheckoutEnabled: true,
      checkoutCvv: null,
      stopOnOosEnabled: false,
    });

    expect(state.cachedAutoCheckoutEnabled).toBe(true);
  });
});
