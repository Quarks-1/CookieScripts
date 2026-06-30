import { describe, expect, it } from "vitest";

import { endpointKey, markerSlug, normalizePathname, upsertEndpoint } from "@ext/lib/walmart/endpoint-index.ts";

describe("endpoint-index", () => {
  it("normalizes numeric path segments", () => {
    expect(normalizePathname("/ip/12345/details")).toBe("/ip/:id/details");
  });

  it("parses endpoint keys from relative URLs", () => {
    const key = endpointKey("POST", "/orchestra/cartxo/graphql/GetCart/abc");
    expect(key?.host).toBe("www.walmart.com");
    expect(key?.graphqlOperation).toBe("GetCart");
  });

  it("upserts endpoint catalog entries", () => {
    const first = upsertEndpoint([], "GET", "https://www.walmart.com/api/item/1", "t1");
    expect(first).toHaveLength(1);
    const second = upsertEndpoint(first, "GET", "https://www.walmart.com/api/item/2", "t2");
    expect(second[0]?.count).toBe(2);
  });

  it("slugifies marker labels", () => {
    expect(markerSlug("Past queue")).toBe("past-queue");
  });

  it("parses endpoint keys", () => {
    expect(endpointKey("POST", "https://api.example.com/v1/cart")?.host).toBe("api.example.com");
  });
});
