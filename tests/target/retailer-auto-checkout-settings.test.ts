import { describe, expect, it } from "vitest";

import {
  getRetailerAutoCheckoutMode,
  setRetailerAutoCheckoutMode,
  shouldEnableRetailerAutoCheckout,
} from "@ext/domains/target/lib/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";

describe("retailer auto checkout settings", () => {
  it("defaults to off when omitted", () => {
    expect(getRetailerAutoCheckoutMode(DEFAULT_SETTINGS)).toBe("off");
  });

  it("persists checkout mode", () => {
    const skuOnly = setRetailerAutoCheckoutMode(DEFAULT_SETTINGS, "sku_only");
    expect(getRetailerAutoCheckoutMode(skuOnly)).toBe("sku_only");
    expect(skuOnly.retailer_auto_checkout_mode).toBe("sku_only");
    expect(skuOnly.retailer_auto_checkout_enabled).toBeUndefined();

    const all = setRetailerAutoCheckoutMode(DEFAULT_SETTINGS, "all");
    expect(getRetailerAutoCheckoutMode(all)).toBe("all");
    expect(all.retailer_auto_checkout_mode).toBe("all");

    const off = setRetailerAutoCheckoutMode(all, "off");
    expect(getRetailerAutoCheckoutMode(off)).toBe("off");
    expect(off.retailer_auto_checkout_mode).toBeUndefined();
  });

  it("migrates legacy enabled boolean to all", () => {
    const legacy = { ...DEFAULT_SETTINGS, retailer_auto_checkout_enabled: true };
    expect(getRetailerAutoCheckoutMode(legacy)).toBe("all");
  });

  it("prefers explicit mode over legacy boolean", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      retailer_auto_checkout_mode: "sku_only" as const,
      retailer_auto_checkout_enabled: true,
    };
    expect(getRetailerAutoCheckoutMode(settings)).toBe("sku_only");
  });

  it("strips legacy boolean on write", () => {
    const legacy = { ...DEFAULT_SETTINGS, retailer_auto_checkout_enabled: true };
    const next = setRetailerAutoCheckoutMode(legacy, "sku_only");
    expect(next.retailer_auto_checkout_enabled).toBeUndefined();
    expect(next.retailer_auto_checkout_mode).toBe("sku_only");
  });

  describe("shouldEnableRetailerAutoCheckout", () => {
    it("returns false when off", () => {
      expect(
        shouldEnableRetailerAutoCheckout(DEFAULT_SETTINGS, { openedViaSkuMatch: true }),
      ).toBe(false);
      expect(
        shouldEnableRetailerAutoCheckout(DEFAULT_SETTINGS, { openedViaSkuMatch: false }),
      ).toBe(false);
    });

    it("returns true for all opens", () => {
      const settings = setRetailerAutoCheckoutMode(DEFAULT_SETTINGS, "all");
      expect(shouldEnableRetailerAutoCheckout(settings, { openedViaSkuMatch: false })).toBe(
        true,
      );
      expect(shouldEnableRetailerAutoCheckout(settings, { openedViaSkuMatch: true })).toBe(
        true,
      );
    });

    it("returns true for sku_only only when opened via SKU match", () => {
      const settings = setRetailerAutoCheckoutMode(DEFAULT_SETTINGS, "sku_only");
      expect(shouldEnableRetailerAutoCheckout(settings, { openedViaSkuMatch: true })).toBe(
        true,
      );
      expect(shouldEnableRetailerAutoCheckout(settings, { openedViaSkuMatch: false })).toBe(
        false,
      );
    });
  });
});
