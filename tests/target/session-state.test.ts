/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyCachedAutoConfig,
  session,
  state,
} from "@ext/domains/target/content/session/session-state.ts";
import { RETAILER_AUTO_RESUME_KEY } from "@ext/domains/target/lib/auto-resume.ts";

describe("applyCachedAutoConfig", () => {
  beforeEach(() => {
    session.running = false;
    state.cachedAutoCheckoutEnabled = false;
    sessionStorage.clear();
  });

  it("preserves checkout flag while session is running", () => {
    state.cachedAutoCheckoutEnabled = true;
    session.running = true;

    applyCachedAutoConfig({
      refreshIntervalSec: 0,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      atcQuantity: 1,
      useMaxQuantity: false,
      autoCheckoutEnabled: false,
    });

    expect(state.cachedAutoCheckoutEnabled).toBe(true);
  });

  it("restores checkout from resume when not running", () => {
    sessionStorage.setItem(
      RETAILER_AUTO_RESUME_KEY,
      JSON.stringify({
        channel_id: "222",
        product_path: "/p/foo/-/A-123",
        phase: "checkout",
        auto_checkout_enabled: true,
        last_refresh_at: 1,
        last_checkout_progress_at: 1,
      }),
    );

    applyCachedAutoConfig({
      refreshIntervalSec: 0,
      frontendAtcEnabled: true,
      backendAtcEnabled: false,
      atcQuantity: 1,
      useMaxQuantity: false,
      autoCheckoutEnabled: false,
    });

    expect(state.cachedAutoCheckoutEnabled).toBe(true);
  });
});
