import { describe, expect, it } from "vitest";

import {
  canonicalizeSuggestionDomain,
  suggestionDomainFromUrl,
} from "@ext/core/lib/suggestion-domains.ts";
import { isBlockedSuggestionDomain } from "@ext/core/lib/blocked-domains.ts";

describe("canonicalizeSuggestionDomain", () => {
  it("maps walmart image hosts to walmart.com", () => {
    expect(canonicalizeSuggestionDomain("i5.walmartimages.com")).toBe("walmart.com");
    expect(canonicalizeSuggestionDomain("walmartimages.com")).toBe("walmart.com");
  });

  it("maps target and amazon asset hosts", () => {
    expect(canonicalizeSuggestionDomain("goto.target.com")).toBe("target.com");
    expect(canonicalizeSuggestionDomain("m.media-amazon.com")).toBe("amazon.com");
  });

  it("leaves unrelated hosts unchanged", () => {
    expect(canonicalizeSuggestionDomain("target.com")).toBe("target.com");
  });
});

describe("suggestionDomainFromUrl", () => {
  it("unwraps walmart affiliate links to walmart.com", () => {
    const affiliate =
      "https://goto.walmart.com/c/123?u=https%3A%2F%2Fwww.walmart.com%2Fip%2Fitem";
    expect(suggestionDomainFromUrl(affiliate)).toBe("walmart.com");
  });

  it("unwraps target affiliate links to target.com", () => {
    const affiliate =
      "https://goto.target.com/c/456?u=https%3A%2F%2Fwww.target.com%2Fp%2Fproduct%2F-%2FA-123";
    expect(suggestionDomainFromUrl(affiliate)).toBe("target.com");
  });

  it("maps walmart image urls to walmart.com", () => {
    expect(suggestionDomainFromUrl("https://i5.walmartimages.com/asr/abc.jpeg")).toBe(
      "walmart.com",
    );
  });

  it("blocks cdns and allows retailer redirect shorteners in suggestions", () => {
    expect(suggestionDomainFromUrl("https://target.scene7.com/is/image/Target/product")).toBe(
      "target.scene7.com",
    );
    expect(isBlockedSuggestionDomain("target.scene7.com")).toBe(true);

    expect(suggestionDomainFromUrl("https://howl.link/abc123")).toBe("howl.link");
    expect(isBlockedSuggestionDomain("howl.link")).toBe(false);

    expect(suggestionDomainFromUrl("https://mavely.app.link/e/abc")).toBe("mavely.app.link");
    expect(isBlockedSuggestionDomain("mavely.app.link")).toBe(false);
  });
});
