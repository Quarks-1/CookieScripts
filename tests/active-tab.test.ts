import { describe, expect, it } from "vitest";

import { resolveActiveTabKind } from "@ext/lib/active-tab.ts";

describe("resolveActiveTabKind", () => {
  it("returns walmart for walmart.com URLs", () => {
    expect(resolveActiveTabKind("https://www.walmart.com/ip/item")).toBe("walmart");
  });

  it("returns retailer for target.com URLs", () => {
    expect(resolveActiveTabKind("https://www.target.com/p/foo/-/A-1")).toBe("retailer");
  });

  it("prefers walmart over other kinds", () => {
    expect(resolveActiveTabKind("https://walmart.com/")).toBe("walmart");
  });
});
