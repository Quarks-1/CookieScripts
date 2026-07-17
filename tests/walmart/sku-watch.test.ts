import { describe, expect, it } from "vitest";

import { resolvePrimaryLink } from "@ext/core/lib/sku-watch/resolve-primary.ts";
import {
  buildWalmartProductUrlFromSku,
  isWalmartAuxiliaryLink,
  normalizeWalmartSku,
  normalizeWalmartSkuList,
  walmartSkuWatchProfile,
} from "@ext/domains/walmart/lib/sku-watch.ts";

const FIXTURE_SKU = "19965460207";

describe("normalizeWalmartSku", () => {
  it("accepts digit-only SKUs within length bounds", () => {
    expect(normalizeWalmartSku(FIXTURE_SKU)).toBe(FIXTURE_SKU);
    expect(normalizeWalmartSku(` ${FIXTURE_SKU} `)).toBe(FIXTURE_SKU);
  });

  it("rejects too-short and too-long values", () => {
    expect(normalizeWalmartSku("12345")).toBeNull();
    expect(normalizeWalmartSku("1".repeat(13))).toBeNull();
  });
});

describe("normalizeWalmartSkuList", () => {
  it("dedupes and drops invalid entries", () => {
    expect(
      normalizeWalmartSkuList([FIXTURE_SKU, FIXTURE_SKU, "abc", "1234567890"]),
    ).toEqual([FIXTURE_SKU, "1234567890"]);
  });
});

describe("buildWalmartProductUrlFromSku", () => {
  it("builds canonical Walmart PDP URL", () => {
    expect(buildWalmartProductUrlFromSku(FIXTURE_SKU)).toBe(
      `https://www.walmart.com/ip/${FIXTURE_SKU}`,
    );
  });
});

describe("isWalmartAuxiliaryLink", () => {
  it("treats Walmart search links as auxiliary", () => {
    expect(
      isWalmartAuxiliaryLink(`https://www.walmart.com/search?q=${FIXTURE_SKU}`, "ATC"),
    ).toBe(true);
  });

  it("treats footer retailer links as auxiliary", () => {
    expect(isWalmartAuxiliaryLink("https://www.ebay.com/item", "eBay")).toBe(true);
    expect(isWalmartAuxiliaryLink("https://www.amazon.com/dp/1", "Amazon")).toBe(true);
  });

  it("does not treat Walmart PDP links as auxiliary", () => {
    expect(
      isWalmartAuxiliaryLink(`https://www.walmart.com/ip/pokemon/${FIXTURE_SKU}`, "Pokemon TCG"),
    ).toBe(false);
    expect(
      isWalmartAuxiliaryLink(`https://www.walmart.com/ip/${FIXTURE_SKU}`, "Pokemon TCG"),
    ).toBe(false);
  });

  it("does not treat affiliate title links as auxiliary", () => {
    expect(isWalmartAuxiliaryLink("https://howl.link/abc", "Pokemon TCG")).toBe(false);
  });
});

describe("resolvePrimaryLink", () => {
  it("returns first non-auxiliary anchor", () => {
    const url = resolvePrimaryLink(
      [
        { href: "https://howl.link/abc", text: "Pokemon TCG" },
        { href: `https://www.walmart.com/search?q=${FIXTURE_SKU}`, text: "ATC" },
      ],
      [`https://www.walmart.com/search?q=${FIXTURE_SKU}`],
      walmartSkuWatchProfile,
    );
    expect(url).toBe("https://howl.link/abc");
  });

  it("falls back to first non-auxiliary flat url", () => {
    const url = resolvePrimaryLink(
      [{ href: `https://www.walmart.com/search?q=${FIXTURE_SKU}`, text: "ATC" }],
      ["https://howl.link/abc", `https://www.walmart.com/search?q=${FIXTURE_SKU}`],
      walmartSkuWatchProfile,
    );
    expect(url).toBe("https://howl.link/abc");
  });

  it("returns null when only auxiliary links exist", () => {
    const url = resolvePrimaryLink(
      [{ href: `https://www.walmart.com/search?q=${FIXTURE_SKU}`, text: "ATC" }],
      [`https://www.walmart.com/search?q=${FIXTURE_SKU}`],
      walmartSkuWatchProfile,
    );
    expect(url).toBeNull();
  });
});
