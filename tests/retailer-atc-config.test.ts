import { describe, expect, it } from "vitest";

import {
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  setRetailerAtcModes,
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
});
