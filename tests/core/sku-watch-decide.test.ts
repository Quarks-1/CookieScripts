import { describe, expect, it } from "vitest";

import { decideSkuOpenAction } from "@ext/core/lib/sku-watch/decide.ts";

describe("decideSkuOpenAction", () => {
  it("returns none when configured SKU list is empty", () => {
    expect(
      decideSkuOpenAction({
        messageText: "SKU 95120834",
        urls: ["https://howl.link/abc"],
        configuredSkus: [],
      }),
    ).toEqual({ action: "none" });
  });

  it("opens constructed PDP when SKU matches", () => {
    expect(
      decideSkuOpenAction({
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

  it("opens constructed PDP when only auxiliary links exist", () => {
    expect(
      decideSkuOpenAction({
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

  it("skips when no configured SKU matches", () => {
    expect(
      decideSkuOpenAction({
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
