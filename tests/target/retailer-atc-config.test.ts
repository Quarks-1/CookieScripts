import { describe, expect, it } from "vitest";

import {
  getRetailerAtcQuantity,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerLinkOpenCount,
  getRetailerUseMaxQuantity,
  normalizeRetailerLinkOpenCount,
  setRetailerAtcModes,
  setRetailerAtcQuantity,
  setRetailerLinkOpenCount,
} from "@ext/domains/target/lib/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";

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

  it("defaults link open count to 1 and clamps invalid values", () => {
    expect(getRetailerLinkOpenCount(DEFAULT_SETTINGS)).toBe(1);
    expect(normalizeRetailerLinkOpenCount(0)).toBe(1);
    expect(normalizeRetailerLinkOpenCount(9)).toBe(9);
  });

  it("persists link open count with omit-when-default semantics", () => {
    const next = setRetailerLinkOpenCount(DEFAULT_SETTINGS, 3);
    expect(getRetailerLinkOpenCount(next)).toBe(3);
    expect(next.retailer_link_open_count).toBe(3);

    const reset = setRetailerLinkOpenCount(next, 1);
    expect(getRetailerLinkOpenCount(reset)).toBe(1);
    expect(reset.retailer_link_open_count).toBeUndefined();
  });
});
