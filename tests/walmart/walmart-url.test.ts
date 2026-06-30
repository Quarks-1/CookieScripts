import { describe, expect, it } from "vitest";

import {
  parseGraphqlOperation,
  redactUrl,
  resolveAbsoluteUrl,
} from "@ext/domains/walmart/lib/url.ts";

describe("walmart url helpers", () => {
  it("resolves relative orchestra graphql paths", () => {
    const absolute = resolveAbsoluteUrl("/orchestra/cartxo/graphql/GetCart/123");
    expect(absolute).toContain("walmart.com");
    expect(parseGraphqlOperation("/orchestra/cartxo/graphql/GetCart/123")).toBe("GetCart");
  });

  it("redacts sensitive query params and graphql variables", () => {
    const redacted = redactUrl(
      "https://www.walmart.com/api?firstName=Jane&customerId=123&variables=%7B%22email%22%3A%22a%40b.com%22%7D",
    );
    expect(redacted).not.toContain("Jane");
    expect(redacted).not.toContain("a@b.com");
    expect(decodeURIComponent(redacted)).toContain("[REDACTED]");
  });
});
