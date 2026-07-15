import { describe, expect, it } from "vitest";

import {
  partitionUrlsByRetailer,
  resolveWatchKeywordRetailer,
} from "@ext/core/lib/retailer-url.ts";

describe("resolveWatchKeywordRetailer", () => {
  it("classifies Walmart URLs", () => {
    expect(resolveWatchKeywordRetailer("https://www.walmart.com/ip/item/123")).toBe("walmart");
  });

  it("classifies Target URLs", () => {
    expect(resolveWatchKeywordRetailer("https://www.target.com/p/foo/-/A-123")).toBe("target");
  });

  it("returns null for other URLs", () => {
    expect(resolveWatchKeywordRetailer("https://amazon.com/dp/123")).toBeNull();
  });
});

describe("partitionUrlsByRetailer", () => {
  it("splits URLs by retailer", () => {
    expect(
      partitionUrlsByRetailer([
        "https://www.walmart.com/ip/1",
        "https://www.target.com/p/x/-/A-1",
        "https://howl.link/abc",
      ]),
    ).toEqual({
      walmart: ["https://www.walmart.com/ip/1"],
      target: ["https://www.target.com/p/x/-/A-1"],
      other: ["https://howl.link/abc"],
    });
  });
});
