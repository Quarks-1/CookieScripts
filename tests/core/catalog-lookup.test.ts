import { describe, expect, it } from "vitest";

import { lookupExpectedPriceCents } from "@ext/core/lib/catalog/lookup.ts";
import type { CatalogData } from "@ext/core/types/index.ts";

const CATALOG: CatalogData = {
  schema_version: 1,
  product_types: ["elite_trainer_box"],
  sets: [{ id: "test-set", name: "Test Set" }],
  products: [
    {
      id: "test-product",
      name: "Perfect Order ETB",
      type: "elite_trainer_box",
      msrp_cents: 4999,
      contents: [{ set_id: "test-set" }],
      listings: [
        { retailer: "target", sku: "95230445" },
        { retailer: "target", sku: "1010873274", marketplace: true, price_cents: 5499 },
      ],
    },
  ],
};

describe("lookupExpectedPriceCents", () => {
  it("returns msrp for first-party target listing", () => {
    expect(lookupExpectedPriceCents(CATALOG, "target", "95230445")).toEqual({
      expectedCents: 4999,
      productName: "Perfect Order ETB",
    });
  });

  it("returns listing price_cents when set", () => {
    expect(lookupExpectedPriceCents(CATALOG, "target", "1010873274")).toEqual({
      expectedCents: 5499,
      productName: "Perfect Order ETB",
    });
  });

  it("normalizes sku input", () => {
    expect(lookupExpectedPriceCents(CATALOG, "target", "A-95230445")).toEqual({
      expectedCents: 4999,
      productName: "Perfect Order ETB",
    });
  });

  it("returns null when sku is missing", () => {
    expect(lookupExpectedPriceCents(CATALOG, "target", "99999999")).toBeNull();
    expect(lookupExpectedPriceCents(CATALOG, "target", "abc")).toBeNull();
  });
});
