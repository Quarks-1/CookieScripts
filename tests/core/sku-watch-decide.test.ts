import { describe, expect, it } from "vitest";

import { decideSkuOpenAction } from "@ext/core/lib/sku-watch/decide.ts";

const WALMART_FIXTURE_SKU = "19965460207";

describe("decideSkuOpenAction", () => {
  it("returns none when configured SKU list is empty", () => {
    expect(
      decideSkuOpenAction("target", {
        messageText: "SKU 95120834",
        urls: ["https://howl.link/abc"],
        configuredSkus: [],
      }),
    ).toEqual({ action: "none" });
  });

  it("opens constructed Target PDP when SKU matches", () => {
    expect(
      decideSkuOpenAction("target", {
        messageText: "Target restock",
        urls: ["https://howl.link/abc", "https://www.target.com/s?searchTerm=95120834"],
        anchors: [
          { href: "https://howl.link/abc", text: "Pokemon TCG" },
          { href: "https://www.target.com/s?searchTerm=95120834", text: "ATC" },
        ],
        configuredSkus: ["95120834"],
      }),
    ).toEqual({
      action: "open",
      url: "https://www.target.com/p/-/A-95120834",
      matchedSku: "95120834",
    });
  });

  it("opens constructed Target PDP when only auxiliary links exist", () => {
    expect(
      decideSkuOpenAction("target", {
        messageText: "Target restock",
        urls: ["https://www.target.com/s?searchTerm=94860231"],
        anchors: [{ href: "https://www.target.com/s?searchTerm=94860231", text: "ATC" }],
        configuredSkus: ["94860231"],
      }),
    ).toEqual({
      action: "open",
      url: "https://www.target.com/p/-/A-94860231",
      matchedSku: "94860231",
    });
  });

  it("skips when no configured Target SKU matches", () => {
    expect(
      decideSkuOpenAction("target", {
        messageText: "random deal",
        urls: ["https://howl.link/abc"],
        configuredSkus: ["11111111"],
      }),
    ).toEqual({
      action: "skip",
      url: "https://howl.link/abc",
    });
  });

  it("opens constructed Walmart PDP when SKU matches", () => {
    expect(
      decideSkuOpenAction("walmart", {
        messageText: "Walmart restock",
        urls: [
          "https://goto.walmart.com/c/abc",
          `https://www.walmart.com/search?q=${WALMART_FIXTURE_SKU}`,
        ],
        anchors: [
          { href: "https://goto.walmart.com/c/abc", text: "Pokemon TCG" },
          { href: `https://www.walmart.com/search?q=${WALMART_FIXTURE_SKU}`, text: "ATC" },
        ],
        configuredSkus: [WALMART_FIXTURE_SKU],
      }),
    ).toEqual({
      action: "open",
      url: `https://www.walmart.com/ip/${WALMART_FIXTURE_SKU}`,
      matchedSku: WALMART_FIXTURE_SKU,
    });
  });

  it("skips when no configured Walmart SKU matches", () => {
    expect(
      decideSkuOpenAction("walmart", {
        messageText: "random deal",
        urls: ["https://howl.link/abc"],
        configuredSkus: ["11111111"],
      }),
    ).toEqual({
      action: "skip",
      url: "https://howl.link/abc",
    });
  });
});
