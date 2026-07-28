import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildCatalogRow,
  groupCatalog,
  resolvePrimarySetId,
} from "@ext/core/lib/catalog/index.ts";
import { parseCatalog } from "@ext/core/lib/catalog/parse.ts";

const catalog = parseCatalog(
  JSON.parse(readFileSync(join(process.cwd(), "extension/core/data/catalog.json"), "utf8")),
);

const emptySelected = { target: new Set<string>(), walmart: new Set<string>() };

function setIndex() {
  return new Map(catalog.sets.map((set) => [set.id, set]));
}

describe("groupCatalog", () => {
  it("groups by set with type subgroups", () => {
    const groups = groupCatalog(catalog, { groupBy: "set", retailerFilter: "all" }, emptySelected);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]?.subgroups.length).toBeGreaterThan(0);
    expect(groups[0]?.alsoContains).toBeDefined();
  });

  it("groups by type with set subgroups and empty alsoContains", () => {
    const groups = groupCatalog(catalog, { groupBy: "type", retailerFilter: "all" }, emptySelected);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.alsoContains).toEqual([]);
    }
  });

  it("resolves primary set by packs then release date", () => {
    const index = setIndex();
    const product = catalog.products.find((entry) => entry.contents.length > 1);
    expect(product).toBeDefined();
    if (!product) {
      return;
    }
    const primary = resolvePrimarySetId(product, index);
    expect(product.contents.some((content) => content.set_id === primary)).toBe(true);
  });

  it("builds dual cells with first-party and marketplace arrays", () => {
    const marketplaceProduct = {
      id: "marketplace-only",
      name: "Marketplace Product",
      type: "elite_trainer_box" as const,
      msrp_cents: 4999,
      contents: [{ set_id: catalog.sets[0]!.id }],
      listings: [{ retailer: "target" as const, sku: "1010873274", marketplace: true }],
    };
    const firstPartyProduct = catalog.products.find((entry) =>
      entry.listings.some((listing) => !listing.marketplace && listing.retailer === "target"),
    );
    expect(firstPartyProduct).toBeDefined();
    if (!firstPartyProduct) {
      return;
    }

    const marketplaceRow = buildCatalogRow(marketplaceProduct, emptySelected);
    const firstPartyRow = buildCatalogRow(firstPartyProduct, emptySelected);
    expect(marketplaceRow.cells.target?.marketplace.length).toBeGreaterThan(0);
    expect(marketplaceRow.cells.target?.firstParty.length).toBe(0);
    expect(firstPartyRow.cells.target?.firstParty.length).toBeGreaterThan(0);
  });

  it("filters by query case-insensitively", () => {
    const product = catalog.products[0]!;
    const needle = product.name.slice(0, 4).toLowerCase();
    const groups = groupCatalog(
      catalog,
      { groupBy: "set", retailerFilter: "all", query: needle },
      emptySelected,
    );
    const rows = groups.flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.rows));
    expect(rows.some((row) => row.product.id === product.id)).toBe(true);
  });

  it("counts first-party SKU totals", () => {
    const groups = groupCatalog(catalog, { groupBy: "set", retailerFilter: "all" }, emptySelected);
    const group = groups[0];
    expect(group).toBeDefined();
    if (!group) {
      return;
    }
    const manual = group.subgroups
      .flatMap((subgroup) => subgroup.rows)
      .reduce((count, row) => count + (row.cells.target?.firstParty.length ?? 0), 0);
    expect(group.totals.target.available).toBe(manual);
  });

  it("keeps selected-only rows when either retailer is selected", () => {
    const product = catalog.products.find((entry) => entry.listings.length > 0);
    expect(product).toBeDefined();
    if (!product) {
      return;
    }
    const sku = product.listings[0]!.sku;
    const retailer = product.listings[0]!.retailer;
    const selected = {
      target: new Set(retailer === "target" ? [sku] : []),
      walmart: new Set(retailer === "walmart" ? [sku] : []),
    };
    const groups = groupCatalog(
      catalog,
      { groupBy: "set", retailerFilter: "all", selectedOnly: true },
      selected,
    );
    const rows = groups.flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.rows));
    expect(rows.some((row) => row.product.id === product.id)).toBe(true);
  });
});
