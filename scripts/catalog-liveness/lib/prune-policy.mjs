/**
 * Whether a single listing should be pruned per locked policy.
 * @param {{ retailer: string, status: string, identity_mismatch?: boolean }} listing
 * @param {{ dropMarketplace?: boolean }} options
 * @returns {boolean}
 */
export function isPrunableListing(
  { retailer, status, identity_mismatch },
  { dropMarketplace = false } = {},
) {
  if (retailer === "target") {
    if (status === "dead") return true;
    if (status === "live_marketplace" && dropMarketplace) return true;
    return false;
  }
  if (retailer === "walmart") {
    if (status === "invalid") return true;
    return false;
  }
  return false;
}

/**
 * @param {object} catalog — full catalog.json object
 * @param {object} report — liveness report
 * @param {{ dropMarketplace?: boolean }} options
 * @returns {{ removed_listings: object[], removed_products: object[], prunedCatalog: object, changes: boolean }}
 */
export function computePrunePlan(catalog, report, options = {}) {
  if (report.blocked) {
    return {
      removed_listings: [],
      removed_products: [],
      prunedCatalog: catalog,
      changes: false,
    };
  }

  const targetBySku = new Map();
  for (const entry of report.target?.listings ?? []) {
    targetBySku.set(entry.sku, entry);
  }
  const walmartBySku = new Map();
  for (const entry of report.walmart?.listings ?? []) {
    walmartBySku.set(entry.sku, entry);
  }

  const removed_listings = [];
  const prunedCatalog = structuredClone(catalog);

  for (const product of prunedCatalog.products) {
    const kept = [];
    for (const listing of product.listings) {
      let reportEntry = null;
      if (listing.retailer === "target") {
        reportEntry = targetBySku.get(listing.sku);
      } else if (listing.retailer === "walmart") {
        reportEntry = walmartBySku.get(listing.sku);
      }

      if (!reportEntry) {
        kept.push(listing);
        continue;
      }

      const prunable = isPrunableListing(
        {
          retailer: listing.retailer,
          status: reportEntry.status,
          identity_mismatch: reportEntry.identity_mismatch ?? false,
        },
        options,
      );

      if (prunable) {
        removed_listings.push({
          retailer: listing.retailer,
          sku: listing.sku,
          product_id: product.id,
          product_name: product.name,
          status: reportEntry.status,
        });
      } else {
        kept.push(listing);
      }
    }
    product.listings = kept;
  }

  const removed_products = [];
  prunedCatalog.products = prunedCatalog.products.filter((product) => {
    if (product.listings.length === 0) {
      removed_products.push({ id: product.id, name: product.name });
      return false;
    }
    return true;
  });

  return {
    removed_listings,
    removed_products,
    prunedCatalog,
    changes: removed_listings.length > 0 || removed_products.length > 0,
  };
}
