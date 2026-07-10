import { describe, expect, it } from "vitest";

import { buildSkuSearchCorpus } from "@ext/core/lib/sku-watch/corpus.ts";
import { findMatchedSku } from "@ext/core/lib/sku-watch/find-matched-sku.ts";
import { messageContainsExactSku } from "@ext/core/lib/sku-watch/match.ts";

describe("messageContainsExactSku", () => {
  it("matches SKU in searchTerm URL", () => {
    const corpus = buildSkuSearchCorpus(
      "Target restock",
      ["https://www.target.com/s?searchTerm=95120834"],
    );
    expect(messageContainsExactSku(corpus, "95120834")).toBe(true);
  });

  it("matches SKU in plain text", () => {
    expect(messageContainsExactSku("SKU 95120834 in stock", "95120834")).toBe(true);
  });

  it("does not match SKU as substring of longer number", () => {
    const corpus = buildSkuSearchCorpus("", ["https://example.com/995120834"]);
    expect(messageContainsExactSku(corpus, "95120834")).toBe(false);
  });

  it("matches SKU in /p/-/A-{sku} path", () => {
    const corpus = buildSkuSearchCorpus("", ["https://www.target.com/p/-/A-94860231"]);
    expect(messageContainsExactSku(corpus, "94860231")).toBe(true);
  });
});

describe("findMatchedSku", () => {
  it("returns first configured SKU that matches corpus order", () => {
    const corpus = buildSkuSearchCorpus("restock", [
      "https://www.target.com/s?searchTerm=22222222",
    ]);
    expect(findMatchedSku(corpus, ["11111111", "22222222", "33333333"])).toBe("22222222");
  });

  it("returns null when no configured SKU matches", () => {
    const corpus = buildSkuSearchCorpus("restock", [
      "https://www.target.com/s?searchTerm=95120834",
    ]);
    expect(findMatchedSku(corpus, ["11111111"])).toBeNull();
  });

  it("matches href-only SKU not present in message text", () => {
    const corpus = buildSkuSearchCorpus("Target - Item Restocked Ad: Pokemon TCG ... ATC", [
      "https://howl.link/abc",
      "https://www.target.com/s?searchTerm=95120834",
    ]);
    expect(findMatchedSku(corpus, ["95120834"])).toBe("95120834");
  });
});
