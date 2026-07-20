/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";

import {
  isWithinCheckoutNavigationGrace,
  markSamsclubAutoRefreshed,
  readSamsclubAutoResume,
  saveSamsclubAutoResume,
  shouldResumeSamsclubCheckout,
  transitionSamsclubAutoResumeToCheckout,
} from "@ext/domains/samsclub/lib/auto-resume.ts";

describe("samsclub auto-resume", () => {
  it("transitions to checkout with auto_checkout_enabled from settings", () => {
    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/foo/123",
      phase: "pdp",
      auto_checkout_enabled: false,
      last_refresh_at: 1,
      last_checkout_progress_at: 1,
    });

    transitionSamsclubAutoResumeToCheckout("manual", "https://www.samsclub.com/ip/foo/123", false);

    expect(readSamsclubAutoResume()).toMatchObject({
      phase: "checkout",
      auto_checkout_enabled: false,
    });
  });

  it("resumes checkout handoff when auto checkout is off", () => {
    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/foo/123",
      phase: "checkout",
      auto_checkout_enabled: false,
      last_refresh_at: 1,
      last_checkout_progress_at: 1,
    });

    expect(
      shouldResumeSamsclubCheckout(
        "https://www.samsclub.com/checkout/review-order?cartId=ca-test",
      ),
    ).not.toBeNull();
  });

  it("starts checkout navigation grace when auto checkout is enabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    transitionSamsclubAutoResumeToCheckout(
      "manual",
      "https://www.samsclub.com/ip/foo/123",
      true,
    );

    expect(isWithinCheckoutNavigationGrace()).toBe(true);

    vi.setSystemTime(new Date("2024-01-01T00:00:31Z"));
    expect(isWithinCheckoutNavigationGrace()).toBe(false);

    vi.useRealTimers();
  });

  it("does not start checkout navigation grace when auto checkout is off", () => {
    transitionSamsclubAutoResumeToCheckout(
      "manual",
      "https://www.samsclub.com/ip/foo/123",
      false,
    );
    expect(isWithinCheckoutNavigationGrace()).toBe(false);
  });

  it("resets checkout progress timestamp when refreshing on checkout phase", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    saveSamsclubAutoResume({
      channel_id: "manual",
      product_path: "/ip/foo/123",
      phase: "checkout",
      auto_checkout_enabled: true,
      last_refresh_at: 1,
      last_checkout_progress_at: 1,
    });

    markSamsclubAutoRefreshed();

    expect(readSamsclubAutoResume()).toMatchObject({
      last_refresh_at: Date.parse("2024-01-01T00:00:00Z"),
      last_checkout_progress_at: Date.parse("2024-01-01T00:00:00Z"),
    });

    vi.useRealTimers();
  });
});
