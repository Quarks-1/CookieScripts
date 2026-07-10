import { describe, expect, it } from "vitest";

import { resolvePrimaryLink } from "@ext/core/lib/sku-watch/resolve-primary.ts";
import {
  buildTargetProductUrlFromSku,
  isTargetAuxiliaryLink,
  normalizeTargetSku,
  normalizeTargetSkuList,
  targetSkuWatchProfile,
} from "@ext/domains/target/lib/sku-watch.ts";

describe("normalizeTargetSku", () => {
  it("accepts digit-only SKUs within length bounds", () => {
    expect(normalizeTargetSku("95120834")).toBe("95120834");
    expect(normalizeTargetSku(" 94860231 ")).toBe("94860231");
  });

  it("rejects too-short and too-long values", () => {
    expect(normalizeTargetSku("12345")).toBeNull();
    expect(normalizeTargetSku("1".repeat(13))).toBeNull();
  });
});

describe("normalizeTargetSkuList", () => {
  it("dedupes and drops invalid entries", () => {
    expect(normalizeTargetSkuList(["95120834", "95120834", "abc", "94860231"])).toEqual([
      "95120834",
      "94860231",
    ]);
  });
});

describe("buildTargetProductUrlFromSku", () => {
  it("builds canonical Target PDP URL", () => {
    expect(buildTargetProductUrlFromSku("94860231")).toBe(
      "https://www.target.com/p/-/A-94860231",
    );
  });
});

describe("isTargetAuxiliaryLink", () => {
  it("treats ATC search links as auxiliary", () => {
    expect(
      isTargetAuxiliaryLink("https://www.target.com/s?searchTerm=95120834", "ATC"),
    ).toBe(true);
  });

  it("treats footer retailer links as auxiliary", () => {
    expect(isTargetAuxiliaryLink("https://www.ebay.com/item", "eBay")).toBe(true);
    expect(isTargetAuxiliaryLink("https://www.amazon.com/dp/1", "Amazon")).toBe(true);
  });

  it("does not treat Target PDP links as auxiliary", () => {
    expect(
      isTargetAuxiliaryLink("https://www.target.com/p/-/A-94860231", "Pokemon TCG"),
    ).toBe(false);
  });

  it("does not treat affiliate title links as auxiliary", () => {
    expect(isTargetAuxiliaryLink("https://howl.link/abc", "Pokemon TCG")).toBe(false);
  });
});

describe("resolvePrimaryLink", () => {
  it("returns first non-auxiliary anchor", () => {
    const url = resolvePrimaryLink(
      [
        { href: "https://howl.link/abc", text: "Pokemon TCG" },
        { href: "https://www.target.com/s?searchTerm=95120834", text: "ATC" },
      ],
      ["https://www.target.com/s?searchTerm=95120834"],
      targetSkuWatchProfile,
    );
    expect(url).toBe("https://howl.link/abc");
  });

  it("falls back to first non-auxiliary flat url", () => {
    const url = resolvePrimaryLink(
      [{ href: "https://www.target.com/s?searchTerm=95120834", text: "ATC" }],
      ["https://howl.link/abc", "https://www.target.com/s?searchTerm=95120834"],
      targetSkuWatchProfile,
    );
    expect(url).toBe("https://howl.link/abc");
  });

  it("returns null when only auxiliary links exist", () => {
    const url = resolvePrimaryLink(
      [{ href: "https://www.target.com/s?searchTerm=95120834", text: "ATC" }],
      ["https://www.target.com/s?searchTerm=95120834"],
      targetSkuWatchProfile,
    );
    expect(url).toBeNull();
  });
});
