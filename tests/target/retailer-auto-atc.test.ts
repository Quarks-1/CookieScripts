import { describe, expect, it } from "vitest";

import {
  getRetailerAutoAtcEnabled,
  setRetailerAutoAtcEnabled,
} from "@ext/domains/target/lib/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";

describe("getRetailerAutoAtcEnabled", () => {
  it("returns true when global flag is set", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      retailer_auto_atc_enabled: true,
    };
    expect(getRetailerAutoAtcEnabled(settings)).toBe(true);
  });

  it("returns false when flag is omitted or off", () => {
    expect(getRetailerAutoAtcEnabled(DEFAULT_SETTINGS)).toBe(false);
    expect(
      getRetailerAutoAtcEnabled({ ...DEFAULT_SETTINGS, retailer_auto_atc_enabled: false }),
    ).toBe(false);
  });
});

describe("setRetailerAutoAtcEnabled", () => {
  it("persists global flag when enabled", () => {
    const next = setRetailerAutoAtcEnabled(DEFAULT_SETTINGS, true);
    expect(next.retailer_auto_atc_enabled).toBe(true);
  });

  it("omits key when disabled", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      retailer_auto_atc_enabled: true,
    };
    const next = setRetailerAutoAtcEnabled(settings, false);
    expect(next.retailer_auto_atc_enabled).toBeUndefined();
  });
});
