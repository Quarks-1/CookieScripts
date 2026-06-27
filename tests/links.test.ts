import { describe, expect, it } from "vitest";

import {
  extractUrls,
  filterUrlsByDomains,
  hostMatches,
  normalizeUrlForDedup,
  stripTrailingPunctuation,
  unwrapAffiliateUrl,
} from "@ext/lib/links.ts";

describe("extractUrls", () => {
  it("returns empty for no links", () => {
    expect(extractUrls("")).toEqual([]);
    expect(extractUrls("no links here")).toEqual([]);
  });

  it("strips trailing punctuation", () => {
    expect(extractUrls("Check https://walmart.com/item. and https://amazon.com/deal!")).toEqual([
      "https://walmart.com/item",
      "https://amazon.com/deal",
    ]);
  });

  it("dedupes in order", () => {
    const text = "https://walmart.com/a https://walmart.com/a https://amazon.com/b";
    expect(extractUrls(text)).toEqual(["https://walmart.com/a", "https://amazon.com/b"]);
  });
});

describe("stripTrailingPunctuation", () => {
  it("strips trailing punctuation", () => {
    expect(stripTrailingPunctuation("https://x.com/).")).toBe("https://x.com/");
  });
});

describe("hostMatches", () => {
  it("matches subdomains and www", () => {
    expect(hostMatches("shop.walmart.com", "walmart.com")).toBe(true);
    expect(hostMatches("WWW.Walmart.com", "walmart.com")).toBe(true);
    expect(hostMatches("notwalmart.com", "walmart.com")).toBe(false);
  });
});

describe("unwrapAffiliateUrl", () => {
  it("unwraps walmart affiliate", () => {
    const affiliate = "https://goto.walmart.com/?u=https%3A%2F%2Fwww.walmart.com%2Fip%2F123";
    expect(unwrapAffiliateUrl(affiliate)).toBe("https://www.walmart.com/ip/123");
  });

  it("leaves non-affiliate unchanged", () => {
    const url = "https://walmart.com/ip/123";
    expect(unwrapAffiliateUrl(url)).toBe(url);
  });
});

describe("normalizeUrlForDedup", () => {
  it("normalizes equivalent walmart urls", () => {
    const a = "https://www.walmart.com/path/";
    const b = "https://goto.walmart.com/?u=https%3A%2F%2Fwalmart.com%2Fpath";
    expect(normalizeUrlForDedup(a)).toBe(normalizeUrlForDedup(b));
  });
});

describe("filterUrlsByDomains", () => {
  it("filters by allowed domains", () => {
    const urls = ["https://walmart.com/a", "https://evil.com/b", "https://shop.amazon.com/c"];
    expect(filterUrlsByDomains(urls, ["walmart.com", "amazon.com"])).toEqual([
      "https://walmart.com/a",
      "https://shop.amazon.com/c",
    ]);
  });

  it("returns empty when no allowed domains", () => {
    expect(filterUrlsByDomains(["https://walmart.com"], [])).toEqual([]);
  });
});
