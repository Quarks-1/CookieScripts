import { describe, expect, it } from "vitest";

import { parseCatalog, stripMarketplaceListings } from "@ext/core/lib/catalog/parse.ts";
import type { CatalogListing } from "@ext/core/types/index.ts";

function minimalCatalogRaw(products: unknown[]) {
  return {
    schema_version: 1,
    product_types: ["elite_trainer_box"],
    sets: [{ id: "test-set", name: "Test Set" }],
    products,
  };
}

describe("stripMarketplaceListings", () => {
  it("removes every marketplace listing", () => {
    const listings: CatalogListing[] = [
      { retailer: "target", sku: "11111111" },
      { retailer: "target", sku: "22222222", marketplace: true },
      { retailer: "walmart", sku: "33333333", marketplace: true },
    ];
    expect(stripMarketplaceListings(listings)).toEqual([{ retailer: "target", sku: "11111111" }]);
  });
});

describe("parseCatalog marketplace stripping", () => {
  it("drops marketplace listings from output", () => {
    const catalog = parseCatalog(
      minimalCatalogRaw([
        {
          id: "mixed-product",
          name: "Mixed Product",
          type: "elite_trainer_box",
          msrp_cents: 4999,
          contents: [{ set_id: "test-set" }],
          listings: [
            { retailer: "target", sku: "95230445" },
            { retailer: "target", sku: "1010873274", marketplace: true, price_cents: 5499 },
          ],
        },
      ]),
    );

    expect(catalog.products).toHaveLength(1);
    expect(catalog.products[0]?.listings).toEqual([{ retailer: "target", sku: "95230445" }]);
  });

  it("drops marketplace-only products", () => {
    const catalog = parseCatalog(
      minimalCatalogRaw([
        {
          id: "marketplace-only",
          name: "Marketplace Only",
          type: "elite_trainer_box",
          msrp_cents: 4999,
          contents: [{ set_id: "test-set" }],
          listings: [{ retailer: "target", sku: "1010873274", marketplace: true }],
        },
        {
          id: "first-party",
          name: "First Party",
          type: "elite_trainer_box",
          msrp_cents: 4999,
          contents: [{ set_id: "test-set" }],
          listings: [{ retailer: "target", sku: "95230445" }],
        },
      ]),
    );

    expect(catalog.products.map((product) => product.id)).toEqual(["first-party"]);
  });
});
