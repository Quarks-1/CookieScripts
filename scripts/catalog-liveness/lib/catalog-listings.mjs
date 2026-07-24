import { readFileSync } from "node:fs";

import { resolveFromRoot } from "./paths.mjs";

/**
 * Load target and walmart listings from catalog.json.
 * @param {string} catalogPath — repo-relative or absolute path
 * @returns {{ products: object[], listings: Array<{ product_id: string, product_name: string, retailer: string, sku: string }> }}
 */
export function loadCatalogListings(catalogPath) {
  const fullPath = catalogPath.startsWith("/") ? catalogPath : resolveFromRoot(catalogPath);
  const catalog = JSON.parse(readFileSync(fullPath, "utf8"));
  const products = catalog.products ?? [];
  const listings = [];

  for (const product of products) {
    for (const listing of product.listings ?? []) {
      if (listing.retailer === "target" || listing.retailer === "walmart") {
        listings.push({
          product_id: product.id,
          product_name: product.name,
          retailer: listing.retailer,
          sku: listing.sku,
        });
      }
    }
  }

  return { products, listings, catalog };
}
