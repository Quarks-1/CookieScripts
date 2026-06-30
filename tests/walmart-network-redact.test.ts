import { describe, expect, it } from "vitest";

import { redactBodySnippet, redactHeaderName } from "@ext/lib/walmart/network-redact.ts";

describe("network-redact", () => {
  it("drops sensitive headers", () => {
    expect(redactHeaderName("Cookie")).toBeNull();
    expect(redactHeaderName("Accept")).toBe("Accept");
  });

  it("redacts sensitive json keys", () => {
    const body = JSON.stringify({ email: "a@b.com", sku: "123" });
    const redacted = redactBodySnippet(body, 10_000);
    expect(redacted).toContain("[REDACTED]");
    expect(redacted).toContain("123");
  });
});
