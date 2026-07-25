import { normalizeTargetSku } from "@ext/domains/target/lib/index.ts";
import type { CatalogData, CatalogRetailer } from "@ext/core/types/index.ts";

export type ExpectedCatalogPrice = {
  expectedCents: number;
  productName: string;
};

export function lookupExpectedPriceCents(
  catalog: CatalogData,
  retailer: CatalogRetailer,
  sku: string,
): ExpectedCatalogPrice | null {
  const normalized =
    retailer === "target" ? normalizeTargetSku(sku) : sku.replace(/\D/g, "");
  if (!normalized) {
    return null;
  }

  for (const product of catalog.products) {
    for (const listing of product.listings) {
      if (listing.retailer !== retailer || listing.sku !== normalized) {
        continue;
      }
      return {
        expectedCents: listing.price_cents ?? product.msrp_cents,
        productName: product.name,
      };
    }
  }

  return null;
}
