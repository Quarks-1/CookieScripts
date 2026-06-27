import { describe, expect, it } from "vitest";

import { validateRetailerProfile } from "@ext/lib/retailer/validate-profile.ts";

describe("retailer profile validation", () => {
  it("accepts a valid profile", () => {
    expect(
      validateRetailerProfile({
        profile_version: 1,
        host: "target.com",
        steps: [{ type: "navigate", url: "https://www.target.com/checkout/start" }],
        descriptors: [],
        updatedAt: new Date().toISOString(),
      }),
    ).toBeNull();
  });

  it("rejects unsupported host", () => {
    expect(
      validateRetailerProfile({
        profile_version: 1,
        host: "walmart.com",
        steps: [],
        descriptors: [],
        updatedAt: new Date().toISOString(),
      }),
    ).toBe("Unsupported retailer host");
  });
});
