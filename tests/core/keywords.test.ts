import { describe, expect, it } from "vitest";

import {
  messageMatchesKeyword,
  normalizeKeyword,
  normalizeKeywordList,
  normalizeTextForMatching,
  shouldOpenByKeywords,
} from "@ext/core/lib/keywords.ts";

describe("normalizeKeyword", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeKeyword("  Foo   Bar  ")).toBe("foo bar");
  });

  it("returns null for whitespace-only input", () => {
    expect(normalizeKeyword("   ")).toBeNull();
  });

  it("returns null when over max length", () => {
    expect(normalizeKeyword("a".repeat(65))).toBeNull();
  });
});

describe("normalizeKeywordList", () => {
  it("dedupes case-insensitively and lowercases", () => {
    expect(normalizeKeywordList(["Pokemon", "POKEMON", "pikachu"])).toEqual([
      "pokemon",
      "pikachu",
    ]);
  });
});

describe("normalizeTextForMatching", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeTextForMatching("  SCAM   LINK  ")).toBe("scam link");
  });
});

describe("messageMatchesKeyword", () => {
  it("matches case-insensitively with whitespace collapse", () => {
    expect(messageMatchesKeyword("deal SCAM   LINK today", "scam link")).toBe(true);
  });

  it("matches multi-word contiguous phrases", () => {
    expect(messageMatchesKeyword("restock chaos rising link", "chaos rising")).toBe(true);
  });

  it("does not match non-contiguous phrase words", () => {
    expect(messageMatchesKeyword("chaos and rising", "chaos rising")).toBe(false);
  });
});

describe("shouldOpenByKeywords", () => {
  const positive = ["pokemon"];
  const negative = ["scam"];

  it("opens when both lists are empty", () => {
    expect(shouldOpenByKeywords("anything", [], [])).toBe(true);
  });

  it("opens on positive match only", () => {
    expect(shouldOpenByKeywords("pokemon restock", positive, negative)).toBe(true);
  });

  it("opens on positive and negative match", () => {
    expect(shouldOpenByKeywords("pokemon scam deal", positive, negative)).toBe(true);
  });

  it("skips on negative-only match", () => {
    expect(shouldOpenByKeywords("this is a scam", positive, negative)).toBe(false);
  });

  it("opens when neither matches", () => {
    expect(shouldOpenByKeywords("random deal", positive, negative)).toBe(true);
  });

  it("opens when message text is empty and only positives configured", () => {
    expect(shouldOpenByKeywords("", positive, [])).toBe(true);
  });

  it("opens when message text is empty and negatives configured", () => {
    expect(shouldOpenByKeywords("", [], negative)).toBe(true);
  });
});
