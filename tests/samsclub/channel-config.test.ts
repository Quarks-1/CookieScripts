import { describe, expect, it } from "vitest";

import {
  getSamsclubAutoCheckoutMode,
  getSamsclubBackendAtcEnabled,
  getSamsclubCheckoutCvv,
  getSamsclubFrontendAtcEnabled,
  getSamsclubRefreshIntervalSec,
  normalizeSamsclubCheckoutCvv,
  normalizeSamsclubRefreshIntervalSec,
  setSamsclubAtcModes,
  setSamsclubAutoCheckoutMode,
  setSamsclubCheckoutCvv,
  shouldEnableSamsclubAutoCheckout,
} from "@ext/domains/samsclub/lib/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";

describe("samsclub channel-config", () => {
  it("normalizes refresh interval", () => {
    expect(normalizeSamsclubRefreshIntervalSec(0)).toBe(0);
    expect(normalizeSamsclubRefreshIntervalSec(15)).toBe(15);
    expect(normalizeSamsclubRefreshIntervalSec(9999)).toBe(3600);
  });

  it("reads global refresh interval", () => {
    expect(getSamsclubRefreshIntervalSec(DEFAULT_SETTINGS)).toBe(0);
    expect(
      getSamsclubRefreshIntervalSec({ ...DEFAULT_SETTINGS, samsclub_refresh_interval_sec: 20 }),
    ).toBe(20);
  });

  it("handles checkout mode off and all", () => {
    expect(getSamsclubAutoCheckoutMode(DEFAULT_SETTINGS)).toBe("off");
    expect(shouldEnableSamsclubAutoCheckout(DEFAULT_SETTINGS)).toBe(false);
    const all = setSamsclubAutoCheckoutMode(DEFAULT_SETTINGS, "all");
    expect(getSamsclubAutoCheckoutMode(all)).toBe("all");
    expect(shouldEnableSamsclubAutoCheckout(all)).toBe(true);
  });

  it("persists off when both ATC modes are disabled", () => {
    const next = setSamsclubAtcModes(DEFAULT_SETTINGS, { frontend: false, backend: false });
    expect(getSamsclubFrontendAtcEnabled(next)).toBe(false);
    expect(getSamsclubBackendAtcEnabled(next)).toBe(false);
    expect(next.samsclub_frontend_atc_enabled).toBe(false);
    expect(next.samsclub_backend_atc_enabled).toBeUndefined();
  });

  it("normalizes and stores checkout cvv", () => {
    expect(normalizeSamsclubCheckoutCvv("123")).toBe("123");
    expect(normalizeSamsclubCheckoutCvv("1234")).toBe("1234");
    expect(normalizeSamsclubCheckoutCvv("12")).toBeNull();
    expect(normalizeSamsclubCheckoutCvv("12345")).toBeNull();
    expect(normalizeSamsclubCheckoutCvv("")).toBeNull();
    expect(getSamsclubCheckoutCvv(DEFAULT_SETTINGS)).toBeNull();

    const withCvv = setSamsclubCheckoutCvv(DEFAULT_SETTINGS, "4567");
    expect(getSamsclubCheckoutCvv(withCvv)).toBe("4567");

    const cleared = setSamsclubCheckoutCvv(withCvv, "");
    expect(getSamsclubCheckoutCvv(cleared)).toBeNull();
    expect(cleared.samsclub_checkout_cvv).toBeUndefined();
  });
});
