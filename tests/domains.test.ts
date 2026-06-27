import { describe, expect, it } from "vitest";

import {
  enabledDomains,
  normalizeDomain,
  pillsFromDomains,
} from "@ext/lib/domains.ts";

describe("normalizeDomain", () => {
  it("strips protocol and www", () => {
    expect(normalizeDomain("https://www.walmart.com/path")).toBe("walmart.com");
  });

  it("accepts bare host", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("rejects empty input", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("rejects host without dot", () => {
    expect(normalizeDomain("localhost")).toBeNull();
  });
});

describe("pillsFromDomains", () => {
  it("creates enabled pills", () => {
    expect(pillsFromDomains(["a.com", "b.com"])).toEqual([
      { domain: "a.com", enabled: true },
      { domain: "b.com", enabled: true },
    ]);
  });
});

describe("enabledDomains", () => {
  it("returns only enabled pill domains", () => {
    const pills = pillsFromDomains(["a.com", "b.com"]);
    pills[1]!.enabled = false;
    expect(enabledDomains(pills)).toEqual(["a.com"]);
  });
});
