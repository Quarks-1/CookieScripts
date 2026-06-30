import { describe, expect, it } from "vitest";

import { isBlockedSuggestionDomain } from "@ext/lib/blocked-domains.ts";

describe("isBlockedSuggestionDomain", () => {
  it("blocks discord hosts and subdomains", () => {
    expect(isBlockedSuggestionDomain("discord.com")).toBe(true);
    expect(isBlockedSuggestionDomain("cdn.discordapp.com")).toBe(true);
    expect(isBlockedSuggestionDomain("walmart.com")).toBe(false);
  });

  it("blocks image cdns and generic shorteners", () => {
    expect(isBlockedSuggestionDomain("target.scene7.com")).toBe(true);
    expect(isBlockedSuggestionDomain("bit.ly")).toBe(true);
    expect(isBlockedSuggestionDomain("target.com")).toBe(false);
  });

  it("allows retailer redirect shorteners", () => {
    expect(isBlockedSuggestionDomain("howl.link")).toBe(false);
    expect(isBlockedSuggestionDomain("mavely.app.link")).toBe(false);
    expect(isBlockedSuggestionDomain("mavely.link")).toBe(false);
  });
});
