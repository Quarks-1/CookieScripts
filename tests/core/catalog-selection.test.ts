import { describe, expect, it } from "vitest";

import {
  buildCatalogCell,
  clearFirstPartyInRows,
  isFirstPartyFullySelected,
  isFirstPartyIndeterminate,
  selectAllFirstPartyInRows,
  toggleFirstPartyCell,
} from "@ext/core/lib/catalog/index.ts";
import type { CatalogListing, CatalogProduct } from "@ext/core/types/index.ts";

function makeProduct(listings: CatalogListing[]): CatalogProduct {
  return {
    id: "test-product",
    name: "Test Product",
    type: "booster_pack",
    msrp_cents: 499,
    contents: [{ set_id: "assorted" }],
    listings,
  };
}

describe("catalog selection", () => {
  const listings: CatalogListing[] = [
    { retailer: "target", sku: "100000001" },
    { retailer: "target", sku: "100000002" },
    { retailer: "target", sku: "100000003", marketplace: true },
  ];

  it("is indeterminate when partially selected then completes then clears", () => {
    const cell = buildCatalogCell(makeProduct(listings), "target", new Set(["100000001"]));
    expect(isFirstPartyIndeterminate(cell)).toBe(true);
    expect(isFirstPartyFullySelected(cell)).toBe(false);

    const completed = toggleFirstPartyCell(cell, new Set(["100000001"]));
    expect(isFirstPartyFullySelected(buildCatalogCell(makeProduct(listings), "target", completed))).toBe(
      true,
    );

    const cleared = toggleFirstPartyCell(cell, completed);
    expect(cleared.size).toBe(0);
  });

  it("select-all skips marketplace listings", () => {
    const product = makeProduct(listings);
    const row = {
      product,
      cells: {
        target: buildCatalogCell(product, "target", new Set()),
        walmart: null,
      },
    };
    const { skus } = selectAllFirstPartyInRows([row], "target", []);
    expect(skus).toEqual(["100000001", "100000002"]);
    expect(skus).not.toContain("100000003");
  });

  it("select-all is all-or-nothing near cap", () => {
    const manyListings: CatalogListing[] = Array.from({ length: 4 }, (_, index) => ({
      retailer: "target" as const,
      sku: `20000000${index}`,
    }));
    const product = makeProduct(manyListings);
    const row = {
      product,
      cells: {
        target: buildCatalogCell(product, "target", new Set()),
        walmart: null,
      },
    };
    const existing = Array.from({ length: 248 }, (_, index) => `3000000${index}`);
    const { skus, skipped } = selectAllFirstPartyInRows([row], "target", existing, 250);
    expect(skus).toEqual(existing);
    expect(skipped).toBe(4);
  });

  it("clear all helpers remove first-party SKUs per retailer", () => {
    const product = makeProduct([
      { retailer: "target", sku: "100000001" },
      { retailer: "walmart", sku: "200000001" },
    ]);
    const row = {
      product,
      cells: {
        target: buildCatalogCell(product, "target", new Set(["100000001"])),
        walmart: buildCatalogCell(product, "walmart", new Set(["200000001"])),
      },
    };
    const target = clearFirstPartyInRows([row], "target", ["100000001", "999999999"]);
    const walmart = clearFirstPartyInRows([row], "walmart", ["200000001"]);
    expect(target).toEqual(["999999999"]);
    expect(walmart).toEqual([]);
  });

  it("caps are independent per retailer in select-all", () => {
    const targetProduct = makeProduct([{ retailer: "target", sku: "100000001" }]);
    const walmartProduct = makeProduct([{ retailer: "walmart", sku: "200000001" }]);
    const rows = [
      {
        product: targetProduct,
        cells: {
          target: buildCatalogCell(targetProduct, "target", new Set()),
          walmart: null,
        },
      },
      {
        product: walmartProduct,
        cells: {
          target: null,
          walmart: buildCatalogCell(walmartProduct, "walmart", new Set()),
        },
      },
    ];
    const fullTarget = Array.from({ length: 250 }, (_, index) => `4000000${index}`);
    const { skus: targetSkus, skipped: targetSkipped } = selectAllFirstPartyInRows(
      [rows[0]!],
      "target",
      fullTarget,
      250,
    );
    const { skus: walmartSkus, skipped: walmartSkipped } = selectAllFirstPartyInRows(
      [rows[1]!],
      "walmart",
      [],
      250,
    );
    expect(targetSkipped).toBe(1);
    expect(targetSkus.length).toBe(250);
    expect(walmartSkipped).toBe(0);
    expect(walmartSkus).toEqual(["200000001"]);
  });
});
