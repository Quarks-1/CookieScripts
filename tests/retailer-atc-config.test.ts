import { describe, expect, it } from "vitest";

import {
  getRetailerAtcQuantity,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerUseMaxQuantity,
  setRetailerAtcModes,
  setRetailerAtcQuantity,
} from "@ext/lib/retailer/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/types/index.ts";

describe("retailer ATC config", () => {
  it("defaults frontend on and backend off", () => {
    expect(getRetailerFrontendAtcEnabled(DEFAULT_SETTINGS)).toBe(true);
    expect(getRetailerBackendAtcEnabled(DEFAULT_SETTINGS)).toBe(false);
  });

  it("persists explicit backend enablement", () => {
    const next = setRetailerAtcModes(DEFAULT_SETTINGS, { frontend: true, backend: true });
    expect(getRetailerBackendAtcEnabled(next)).toBe(true);
    expect(getRetailerFrontendAtcEnabled(next)).toBe(true);
  });

  it("rejects disabling both ATC modes", () => {
    expect(() =>
      setRetailerAtcModes(DEFAULT_SETTINGS, { frontend: false, backend: false }),
    ).toThrow("Enable at least one ATC method");
  });

  it("defaults quantity to 1 and max override off", () => {
    expect(getRetailerAtcQuantity(DEFAULT_SETTINGS)).toBe(1);
    expect(getRetailerUseMaxQuantity(DEFAULT_SETTINGS)).toBe(false);
  });

  it("persists quantity settings with omit-when-default semantics", () => {
    const next = setRetailerAtcQuantity(DEFAULT_SETTINGS, {
      quantity: 3,
      useMaxQuantity: true,
    });
    expect(getRetailerAtcQuantity(next)).toBe(3);
    expect(getRetailerUseMaxQuantity(next)).toBe(true);
    expect(next.retailer_atc_quantity).toBe(3);
    expect(next.retailer_use_max_quantity).toBe(true);

    const reset = setRetailerAtcQuantity(next, { quantity: 1, useMaxQuantity: false });
    expect(reset.retailer_atc_quantity).toBeUndefined();
    expect(reset.retailer_use_max_quantity).toBeUndefined();
  });
});
