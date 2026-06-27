import { describe, expect, it } from "vitest";

import { isBlockedSuggestionDomain } from "@ext/lib/blocked-domains.ts";

describe("isBlockedSuggestionDomain", () => {
  it("blocks discord hosts and subdomains", () => {
    expect(isBlockedSuggestionDomain("discord.com")).toBe(true);
    expect(isBlockedSuggestionDomain("cdn.discordapp.com")).toBe(true);
    expect(isBlockedSuggestionDomain("walmart.com")).toBe(false);
  });

  it("blocks image cdns and affiliate shorteners", () => {
    expect(isBlockedSuggestionDomain("target.scene7.com")).toBe(true);
    expect(isBlockedSuggestionDomain("howl.link")).toBe(true);
    expect(isBlockedSuggestionDomain("mavely.app.link")).toBe(true);
    expect(isBlockedSuggestionDomain("target.com")).toBe(false);
  });
});
