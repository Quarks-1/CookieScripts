import { describe, expect, it } from "vitest";

import { detectAutoMarker } from "@ext/content/walmart/recorder/auto-markers.ts";
import { isResearchResourceUrl } from "@ext/content/walmart/recorder/perf-backfill.ts";
import {
  graphqlSignalForOperation,
  isOrchestraFailureStatus,
} from "@ext/lib/walmart/graphql-signals.ts";

describe("auto-markers", () => {
  it("detects product and checkout URLs", () => {
    expect(detectAutoMarker("https://www.walmart.com/ip/foo/123")?.label).toBe("Product page");
    expect(detectAutoMarker("https://www.walmart.com/cart")?.label).toBe("Cart page");
    expect(detectAutoMarker("https://www.walmart.com/pac")?.label).toBe("PAC");
    expect(detectAutoMarker("https://www.walmart.com/search?q=soap")?.label).toBe("Search");
    expect(detectAutoMarker("https://www.walmart.com/blocked?url=foo")?.label).toBe("Blocked");
    expect(detectAutoMarker("https://www.walmart.com/checkout/review-order")?.label).toBe(
      "Pre-checkout",
    );
    expect(detectAutoMarker("https://www.walmart.com/checkout/review-order")?.detail).toBe(
      "review-order",
    );
    expect(detectAutoMarker("https://www.walmart.com/thankyou")?.label).toBe("Post-checkout");
    expect(detectAutoMarker("https://www.walmart.com/queue/waiting")?.label).toBe("Joined queue");
  });
});

describe("resource backfill filter", () => {
  it("keeps orchestra graphql and swag resources only", () => {
    expect(
      isResearchResourceUrl(
        "https://www.walmart.com/orchestra/home/graphql/PostCartLoadPage/hash",
      ),
    ).toBe(true);
    expect(isResearchResourceUrl("https://www.walmart.com/swag/graphql")).toBe(true);
    expect(
      isResearchResourceUrl(
        "https://i5.walmartimages.com/dfw/63fd9f59-6705/uuid/v2/en-US/_next/static/chunks/55305.js",
      ),
    ).toBe(false);
  });
});

describe("graphql signals", () => {
  it("maps core cart operations", () => {
    expect(graphqlSignalForOperation("updateItems")).toBe("gql_atc");
    expect(graphqlSignalForOperation("getCart")).toBe("gql_cart_read");
    expect(isOrchestraFailureStatus(456)).toBe(true);
  });
});
