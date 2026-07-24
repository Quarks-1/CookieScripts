import { normalizeTargetSku } from "@ext/domains/target/lib/index.ts";
import { normalizeWalmartSku } from "@ext/domains/walmart/lib/index.ts";
import type {
  CatalogData,
  CatalogListing,
  CatalogProduct,
  CatalogRetailer,
  CatalogSet,
} from "@ext/core/types/index.ts";

const SUPPORTED_SCHEMA_VERSION = 1;

function normalizeListingSku(retailer: CatalogRetailer, sku: string): string {
  const normalized =
    retailer === "target" ? normalizeTargetSku(sku) : normalizeWalmartSku(sku);
  if (!normalized) {
    throw new Error(`Invalid ${retailer} SKU: ${sku}`);
  }
  return normalized;
}

function parseSet(raw: unknown, index: number): CatalogSet {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Invalid set at index ${index}`);
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new Error(`Set at index ${index} missing id`);
  }
  if (typeof record.name !== "string" || !record.name.trim()) {
    throw new Error(`Set ${record.id} missing name`);
  }
  const set: CatalogSet = { id: record.id, name: record.name };
  if (record.released_on !== undefined) {
    if (typeof record.released_on !== "string" || !record.released_on.trim()) {
      throw new Error(`Set ${record.id} has invalid released_on`);
    }
    set.released_on = record.released_on;
  }
  if (record.kind === "assorted") {
    set.kind = "assorted";
  }
  return set;
}

function parseListing(raw: unknown, productId: string, index: number): CatalogListing {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Invalid listing on product ${productId} at index ${index}`);
  }
  const record = raw as Record<string, unknown>;
  if (record.retailer !== "target" && record.retailer !== "walmart") {
    throw new Error(`Invalid retailer on product ${productId} listing ${index}`);
  }
  if (typeof record.sku !== "string" || !record.sku.trim()) {
    throw new Error(`Missing SKU on product ${productId} listing ${index}`);
  }
  const listing: CatalogListing = {
    retailer: record.retailer,
    sku: normalizeListingSku(record.retailer, record.sku),
  };
  if (record.marketplace !== undefined) {
    if (typeof record.marketplace !== "boolean") {
      throw new Error(`Invalid marketplace flag on product ${productId} SKU ${listing.sku}`);
    }
    if (record.marketplace) {
      listing.marketplace = true;
    }
  }
  if (record.price_cents !== undefined) {
    if (typeof record.price_cents !== "number" || record.price_cents <= 0) {
      throw new Error(`Invalid price_cents on product ${productId} SKU ${listing.sku}`);
    }
    listing.price_cents = record.price_cents;
  }
  return listing;
}

/** Drop marketplace listings when the same product already has first-party for that retailer. */
export function stripRedundantMarketplaceListings(listings: CatalogListing[]): CatalogListing[] {
  const firstPartyRetailers = new Set(
    listings.filter((listing) => !listing.marketplace).map((listing) => listing.retailer),
  );
  return listings.filter(
    (listing) => !listing.marketplace || !firstPartyRetailers.has(listing.retailer),
  );
}

function parseProduct(raw: unknown, productTypes: ReadonlySet<string>, index: number): CatalogProduct {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Invalid product at index ${index}`);
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new Error(`Product at index ${index} missing id`);
  }
  const productId = record.id;
  if (typeof record.name !== "string" || !record.name.trim()) {
    throw new Error(`Product ${productId} missing name`);
  }
  if (typeof record.type !== "string" || !productTypes.has(record.type)) {
    throw new Error(`Product ${productId} has unknown type ${String(record.type)}`);
  }
  if (typeof record.msrp_cents !== "number" || record.msrp_cents <= 0) {
    throw new Error(`Product ${productId} has invalid msrp_cents`);
  }
  if (!Array.isArray(record.contents)) {
    throw new Error(`Product ${productId} missing contents array`);
  }
  if (!Array.isArray(record.listings)) {
    throw new Error(`Product ${productId} missing listings array`);
  }

  const contents = record.contents.map((entry, contentIndex) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Invalid contents entry on product ${productId} at index ${contentIndex}`);
    }
    const content = entry as Record<string, unknown>;
    if (typeof content.set_id !== "string" || !content.set_id.trim()) {
      throw new Error(`Invalid set_id on product ${productId} contents ${contentIndex}`);
    }
    const next: CatalogProduct["contents"][number] = { set_id: content.set_id };
    if (content.packs !== undefined) {
      if (typeof content.packs !== "number" || content.packs <= 0) {
        throw new Error(`Invalid packs on product ${productId} contents ${contentIndex}`);
      }
      next.packs = content.packs;
    }
    return next;
  });

  const listings = stripRedundantMarketplaceListings(
    record.listings.map((listing, listingIndex) => parseListing(listing, productId, listingIndex)),
  );

  const listingKeys = new Set<string>();
  for (const listing of listings) {
    const key = `${listing.retailer}:${listing.sku}`;
    if (listingKeys.has(key)) {
      throw new Error(`Duplicate listing ${key} on product ${productId}`);
    }
    listingKeys.add(key);
  }

  return {
    id: productId,
    name: record.name,
    type: record.type,
    msrp_cents: record.msrp_cents,
    contents,
    listings,
  };
}

export function parseCatalog(raw: unknown): CatalogData {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Catalog must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (record.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`Unsupported catalog schema_version: ${String(record.schema_version)}`);
  }
  if (!Array.isArray(record.product_types) || record.product_types.length === 0) {
    throw new Error("Catalog missing product_types");
  }
  if (!Array.isArray(record.sets) || record.sets.length === 0) {
    throw new Error("Catalog missing sets");
  }
  if (!Array.isArray(record.products)) {
    throw new Error("Catalog missing products");
  }

  const productTypes = new Set<string>();
  for (const type of record.product_types) {
    if (typeof type !== "string" || !type.trim()) {
      throw new Error("Invalid product type entry");
    }
    productTypes.add(type);
  }

  const sets = record.sets.map((set, index) => parseSet(set, index));
  const setIds = new Set<string>();
  for (const set of sets) {
    if (setIds.has(set.id)) {
      throw new Error(`Duplicate set id: ${set.id}`);
    }
    setIds.add(set.id);
  }

  const products = record.products.map((product, index) =>
    parseProduct(product, productTypes, index),
  );
  const productIds = new Set<string>();
  const skuOwners = new Map<string, string>();

  for (const product of products) {
    if (productIds.has(product.id)) {
      throw new Error(`Duplicate product id: ${product.id}`);
    }
    productIds.add(product.id);

    for (const content of product.contents) {
      if (!setIds.has(content.set_id)) {
        throw new Error(`Product ${product.id} references unknown set ${content.set_id}`);
      }
    }

    for (const listing of product.listings) {
      const key = `${listing.retailer}:${listing.sku}`;
      const owner = skuOwners.get(key);
      if (owner && owner !== product.id) {
        throw new Error(`SKU ${listing.sku} reused across products ${owner} and ${product.id}`);
      }
      skuOwners.set(key, product.id);
    }
  }

  return {
    schema_version: SUPPORTED_SCHEMA_VERSION,
    product_types: [...record.product_types],
    sets,
    products,
  };
}
