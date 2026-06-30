import { describe, expect, it } from "vitest";

import { normalizeDomain, domainFromUrl } from "@ext/core/lib/domains.ts";

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

describe("domainFromUrl", () => {
  it("extracts normalized host from urls", () => {
    expect(domainFromUrl("https://www.walmart.com/deal?id=1")).toBe("walmart.com");
  });

  it("returns null for invalid urls", () => {
    expect(domainFromUrl("not-a-url")).toBeNull();
  });
});
