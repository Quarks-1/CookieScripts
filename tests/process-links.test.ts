import { describe, expect, it } from "vitest";

import { decideLinkActions } from "@ext/lib/process-links.ts";

describe("decideLinkActions", () => {
  const baseInput = {
    urls: ["https://walmart.com/item"],
    allowedDomains: ["walmart.com"],
    recentUrlKeys: new Set<string>(),
    enabled: true,
    channelId: "1234567890123456789",
    author: "tester",
  };

  it("opens matching allowlisted urls", () => {
    const result = decideLinkActions(baseInput);
    expect(result.toOpen).toEqual(["https://walmart.com/item"]);
    expect(result.duplicates).toEqual([]);
    expect(result.newDedupKeys).toHaveLength(1);
    expect(result.historyEntries).toHaveLength(1);
    expect(result.historyEntries[0]?.kind).toBe("opened");
  });

  it("skips when disabled", () => {
    const result = decideLinkActions({ ...baseInput, enabled: false });
    expect(result.toOpen).toEqual([]);
    expect(result.historyEntries).toEqual([]);
  });

  it("skips non-allowlisted domains", () => {
    const result = decideLinkActions({
      ...baseInput,
      urls: ["https://evil.com/item"],
    });
    expect(result.toOpen).toEqual([]);
  });

  it("rejects non-http(s) urls", () => {
    const result = decideLinkActions({
      ...baseInput,
      urls: ["javascript:alert(1)"],
    });
    expect(result.toOpen).toEqual([]);
  });

  it("marks duplicates via recentUrlKeys", () => {
    const dedupKey = "https://walmart.com/item";
    const result = decideLinkActions({
      ...baseInput,
      recentUrlKeys: new Set([dedupKey]),
    });
    expect(result.toOpen).toEqual([]);
    expect(result.duplicates).toEqual(["https://walmart.com/item"]);
    expect(result.historyEntries[0]?.kind).toBe("duplicate");
  });

  it("dedupes affiliate equivalent urls", () => {
    const first = decideLinkActions({
      ...baseInput,
      urls: ["https://www.walmart.com/path/"],
    });
    const recent = new Set(first.newDedupKeys);
    const second = decideLinkActions({
      ...baseInput,
      urls: ["https://goto.walmart.com/?u=https%3A%2F%2Fwalmart.com%2Fpath"],
      recentUrlKeys: recent,
    });
    expect(second.toOpen).toEqual([]);
    expect(second.duplicates).toHaveLength(1);
  });
});
