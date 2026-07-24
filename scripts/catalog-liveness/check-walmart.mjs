import { classifyWalmartProbe, parseWalmartProbeResponse } from "./lib/classify-walmart.mjs";
import { USER_AGENT } from "./lib/paths.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} itemId
 * @returns {Promise<{ http: number, validHeader: string | null, seoUrl: string | null, error?: string }>}
 */
async function probe(itemId) {
  try {
    const res = await fetch(`https://www.walmart.com/ip/${itemId}`, {
      headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" },
      redirect: "manual",
    });
    const { validHeader, seoUrl } = parseWalmartProbeResponse(res);
    return { http: res.status, validHeader, seoUrl };
  } catch (e) {
    return { http: 0, validHeader: null, seoUrl: null, error: String(e).slice(0, 80) };
  }
}

/**
 * @param {{ listings: object[], delayMs?: number }} params
 * @returns {Promise<{ listings: object[] }>}
 */
export async function runWalmartCheck({ listings, delayMs = 1500 }) {
  const walmartListings = listings.filter((l) => l.retailer === "walmart");
  const results = [];

  console.log(`checking ${walmartListings.length} Walmart listings\n`);

  let n = 0;
  for (const entry of walmartListings) {
    const probed = await probe(entry.sku);
    const classified = classifyWalmartProbe({
      validHeader: probed.validHeader,
      seoUrl: probed.seoUrl,
      ourName: entry.product_name,
    });
    results.push({
      sku: entry.sku,
      status: classified.status,
      identity_mismatch: classified.identity_mismatch,
      similarity: classified.similarity,
      walmart_slug: classified.walmart_slug,
      our_name: entry.product_name,
      http: probed.http,
      checked_at: new Date().toISOString(),
      product_id: entry.product_id,
      ...(probed.error ? { error: probed.error } : {}),
    });
    n += 1;
    const flag =
      classified.status !== "valid"
        ? `  <<< ${classified.status.toUpperCase()}`
        : classified.identity_mismatch
          ? "  <<< NAME MISMATCH"
          : "";
    console.log(
      `${String(n).padStart(3)}/${walmartListings.length}  ${entry.sku.padEnd(13)} ${classified.status.padEnd(8)} sim=${classified.similarity.toFixed(2)}  ${entry.product_name.slice(0, 38).padEnd(40)}${flag}`,
    );
    await sleep(delayMs);
  }

  return { listings: results };
}

import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { loadCatalogListings } = await import("./lib/catalog-listings.mjs");
  const { CATALOG_PATH } = await import("./lib/paths.mjs");
  try {
    const { listings } = loadCatalogListings(CATALOG_PATH);
    await runWalmartCheck({ listings });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
