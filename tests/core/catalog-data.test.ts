import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCatalog } from "@ext/core/lib/catalog/parse.ts";
import { normalizeTargetSku } from "@ext/domains/target/lib/sku-watch.ts";
import { normalizeWalmartSku } from "@ext/domains/walmart/lib/sku-watch.ts";

const CATALOG_PATH = join(process.cwd(), "extension/core/data/catalog.json");

describe("catalog-data", () => {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const catalog = parseCatalog(raw);

  it("parses shipped catalog.json", () => {
    expect(catalog.schema_version).toBe(1);
    expect(catalog.products.length).toBeGreaterThan(0);
    expect(catalog.sets.length).toBeGreaterThan(0);
  });

  it("has unique product ids", () => {
    const ids = catalog.products.map((product) => product.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("normalizes SKUs and disallows reuse across products", () => {
    const seen = new Set<string>();
    for (const product of catalog.products) {
      for (const listing of product.listings) {
        const normalized =
          listing.retailer === "target"
            ? normalizeTargetSku(listing.sku)
            : normalizeWalmartSku(listing.sku);
        expect(normalized).toBe(listing.sku);
        const key = `${listing.retailer}:${listing.sku}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("allows multiple listings per retailer on one product", () => {
    const multi = catalog.products.find((product) => {
      const target = product.listings.filter((listing) => listing.retailer === "target");
      return target.length > 1;
    });
    expect(multi).toBeDefined();
  });

  it("round-trips marketplace flag", () => {
    const marketplace = catalog.products.flatMap((product) =>
      product.listings.filter((listing) => listing.marketplace),
    );
    expect(marketplace.length).toBeGreaterThan(0);
    for (const listing of marketplace) {
      expect(listing.marketplace).toBe(true);
    }
  });

  it("drops marketplace listings when first-party exists for the same retailer", () => {
    for (const product of catalog.products) {
      const firstPartyRetailers = new Set(
        product.listings.filter((listing) => !listing.marketplace).map((listing) => listing.retailer),
      );
      for (const listing of product.listings) {
        if (listing.marketplace) {
          expect(firstPartyRetailers.has(listing.retailer)).toBe(false);
        }
      }
    }
  });

  it("resolves types and set_ids", () => {
    const typeSet = new Set(catalog.product_types);
    const setIds = new Set(catalog.sets.map((set) => set.id));
    for (const product of catalog.products) {
      expect(typeSet.has(product.type)).toBe(true);
      expect(product.msrp_cents).toBeGreaterThan(0);
      for (const content of product.contents) {
        expect(setIds.has(content.set_id)).toBe(true);
      }
    }
  });

  it("includes assorted set", () => {
    expect(catalog.sets.some((set) => set.id === "assorted")).toBe(true);
  });
});
