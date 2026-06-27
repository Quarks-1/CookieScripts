import { describe, expect, it } from "vitest";

import {
  allowlistIncludesRetailerHost,
  isRetailerProductUrl,
  isRetailerUrl,
} from "@ext/lib/retailer/host.ts";

describe("retailer host", () => {
  it("detects target.com urls", () => {
    expect(isRetailerUrl("https://www.target.com/p/item/-/A-123")).toBe(true);
    expect(isRetailerUrl("https://walmart.com/item")).toBe(false);
  });

  it("detects product urls", () => {
    expect(isRetailerProductUrl("https://www.target.com/p/foo/-/A-1")).toBe(true);
    expect(isRetailerUrl("https://www.target.com/cart")).toBe(true);
    expect(isRetailerProductUrl("https://www.target.com/cart")).toBe(false);
  });

  it("unwraps goto.target.com affiliate urls", () => {
    const affiliate =
      "https://goto.target.com/c/456?u=https%3A%2F%2Fwww.target.com%2Fp%2Fproduct%2F-%2FA-123";
    expect(isRetailerProductUrl(affiliate)).toBe(true);
  });

  it("gates allowlist on target.com", () => {
    expect(allowlistIncludesRetailerHost(["amazon.com", "target.com"])).toBe(true);
    expect(allowlistIncludesRetailerHost(["amazon.com"])).toBe(false);
  });
});
