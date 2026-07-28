/**
 * Throwaway transform: catalog-draft.json → extension/core/data/catalog.json
 * Not shipped with the extension.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");
const DRAFT_PATH = join(ROOT, "research/discord/catalog-draft.json");
const TARGET_CURATED_PATH = join(ROOT, "research/discord/curated-target.json");
const WALMART_CURATED_PATH = join(ROOT, "research/discord/curated-walmart.json");
const OUT_PATH = join(ROOT, "extension/core/data/catalog.json");

const PRODUCT_TYPES = [
  "booster_pack",
  "sleeved_booster_pack",
  "single_pack_blister",
  "three_pack_blister",
  "checklane_blister",
  "premium_checklane_blister",
  "booster_bundle",
  "elite_trainer_box",
  "build_battle_box",
  "tin",
  "collection_box",
  "premium_collection",
  "special_box",
  "booster_box",
];

function slugify(name, type) {
  return `${name}-${type}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildHitsMap(curated) {
  const map = new Map();
  for (const entry of curated.kept ?? []) {
    map.set(String(entry.sku), entry.hits ?? 0);
  }
  return map;
}

function sortListings(listings, targetHits, walmartHits) {
  const byRetailer = { target: [], walmart: [] };
  for (const listing of listings) {
    if (listing.retailer === "target" || listing.retailer === "walmart") {
      byRetailer[listing.retailer].push(listing);
    }
  }

  const result = [];
  for (const retailer of ["target", "walmart"]) {
    const hits = retailer === "target" ? targetHits : walmartHits;
    const bucket = byRetailer[retailer].filter((listing) => !listing.marketplace);
    bucket.sort((a, b) => (hits.get(b.sku) ?? 0) - (hits.get(a.sku) ?? 0));
    result.push(...bucket);
  }
  return result;
}

function stripListing(listing) {
  const next = { retailer: listing.retailer, sku: String(listing.sku) };
  if (typeof listing.price_cents === "number" && listing.price_cents > 0) {
    next.price_cents = listing.price_cents;
  }
  return next;
}

function stripContents(contents) {
  return contents.map((entry) => {
    const next = { set_id: entry.set_id };
    if (typeof entry.packs === "number" && entry.packs > 0) {
      next.packs = entry.packs;
    }
    return next;
  });
}

function assignProductIds(products) {
  const used = new Set();
  return products.map((product) => {
    let base = slugify(product.name, product.type);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { ...product, id };
  });
}

function mapSet(set) {
  const next = { id: set.id, name: set.name };
  if (set.released_on) {
    next.released_on = set.released_on;
  }
  if (set.kind === "assorted") {
    next.kind = "assorted";
  }
  return next;
}

function main() {
  const draft = JSON.parse(readFileSync(DRAFT_PATH, "utf8"));
  const targetHits = buildHitsMap(JSON.parse(readFileSync(TARGET_CURATED_PATH, "utf8")));
  const walmartHits = buildHitsMap(JSON.parse(readFileSync(WALMART_CURATED_PATH, "utf8")));

  const draftProducts = draft.products
    .map((product) => ({
      name: product.name,
      type: product.type,
      msrp_cents: product.msrp_cents,
      contents: stripContents(product.contents ?? []),
      listings: sortListings(product.listings ?? [], targetHits, walmartHits).map(stripListing),
    }))
    .filter((product) => product.listings.length > 0);

  const products = assignProductIds(draftProducts);

  const referenced = new Set(products.flatMap((product) => product.contents.map((entry) => entry.set_id)));
  const sets = draft.sets
    .filter((set) => referenced.has(set.id) || set.id === "assorted")
    .map(mapSet);

  if (!sets.some((set) => set.id === "assorted")) {
    sets.push({ id: "assorted", name: "Assorted Packs", kind: "assorted" });
  }

  const catalog = {
    schema_version: 1,
    product_types: PRODUCT_TYPES,
    sets,
    products,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(
    `Wrote ${OUT_PATH}: ${products.length} products, ${products.reduce((n, p) => n + p.listings.length, 0)} listings, ${sets.length} sets`,
  );
}

main();
