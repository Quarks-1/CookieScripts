import { describe, expect, it } from "vitest";

import {
  buildCheckoutReviewOrderUrl,
  readSamsclubCartId,
} from "@ext/domains/samsclub/lib/cart-id.ts";
import { resolveCheckoutStartUrl } from "@ext/domains/samsclub/lib/playback-engine.ts";

describe("samsclub cart-id", () => {
  it("reads cart id from glassCartIdMap object values", () => {
    const storage = {
      getItem(key: string) {
        if (key !== "glassCartIdMap") {
          return null;
        }
        return JSON.stringify({ REGULAR: "ca-abc-123" });
      },
    } as Storage;

    expect(readSamsclubCartId(storage)).toBe("ca-abc-123");
  });

  it("builds review-order checkout URL", () => {
    expect(buildCheckoutReviewOrderUrl("ca-abc-123")).toBe(
      "https://www.samsclub.com/checkout/review-order?cartId=ca-abc-123",
    );
  });

  it("resolves checkout URL from glassCartIdMap", () => {
    const storage = {
      getItem(key: string) {
        return key === "glassCartIdMap" ? JSON.stringify("ca-test-999") : null;
      },
    } as Storage;
    const doc = {
      defaultView: { localStorage: storage },
    } as Document;
    expect(resolveCheckoutStartUrl(doc)).toBe(
      "https://www.samsclub.com/checkout/review-order?cartId=ca-test-999",
    );
  });
});
