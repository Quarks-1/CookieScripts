import { describe, expect, it } from "vitest";

import {
  getRetailerAutoCheckoutEnabled,
  setRetailerAutoCheckoutEnabled,
} from "@ext/lib/retailer/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/types/index.ts";

describe("retailer auto checkout settings", () => {
  it("defaults to disabled when omitted", () => {
    expect(getRetailerAutoCheckoutEnabled(DEFAULT_SETTINGS)).toBe(false);
  });

  it("persists enabled flag", () => {
    const enabled = setRetailerAutoCheckoutEnabled(DEFAULT_SETTINGS, true);
    expect(getRetailerAutoCheckoutEnabled(enabled)).toBe(true);
    expect(enabled.retailer_auto_checkout_enabled).toBe(true);

    const disabled = setRetailerAutoCheckoutEnabled(enabled, false);
    expect(getRetailerAutoCheckoutEnabled(disabled)).toBe(false);
    expect(disabled.retailer_auto_checkout_enabled).toBeUndefined();
  });
});
