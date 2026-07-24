#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { runTargetCheck } from "./check-target.mjs";
import { runWalmartCheck } from "./check-walmart.mjs";
import { loadCatalogListings } from "./lib/catalog-listings.mjs";
import { computePrunePlan } from "./lib/prune-policy.mjs";
import { CATALOG_PATH, REPORT_PATH, resolveFromRoot } from "./lib/paths.mjs";

/**
 * @param {object[]} targetListings
 * @param {object[]} walmartListings
 * @param {{ removed_listings: object[], removed_products: object[] }} prunePlan
 * @param {boolean} blocked
 */
function buildSummary(targetListings, walmartListings, prunePlan, blocked) {
  const summary = {
    target: { dead: 0, live: 0, live_marketplace: 0, unclear: 0 },
    walmart: { valid: 0, invalid: 0, unclear: 0, identity_mismatch: 0 },
    prunable_listings: blocked ? 0 : prunePlan.removed_listings.length,
    prunable_products: blocked ? 0 : prunePlan.removed_products.length,
  };

  for (const entry of targetListings) {
    if (entry.status in summary.target) {
      summary.target[entry.status] += 1;
    }
  }
  for (const entry of walmartListings) {
    if (entry.status in summary.walmart) {
      summary.walmart[entry.status] += 1;
    }
    if (entry.identity_mismatch) {
      summary.walmart.identity_mismatch += 1;
    }
  }

  return summary;
}

function printSummary(summary, blocked) {
  console.log("\n--- Catalog Liveness Summary ---");
  console.log(`Target: ${JSON.stringify(summary.target)}`);
  console.log(`Walmart: ${JSON.stringify(summary.walmart)}`);
  if (blocked) {
    console.log("BLOCKED: control TCIN read dead — Walmart skipped, prunable counts zeroed");
  } else {
    console.log(
      `Prunable: ${summary.prunable_listings} listing(s), ${summary.prunable_products} product(s)`,
    );
  }
}

async function main() {
  const { catalog, listings } = loadCatalogListings(CATALOG_PATH);

  console.log("=== Target liveness ===\n");
  const targetResult = await runTargetCheck({ listings });

  let walmartResult = { listings: [] };
  if (!targetResult.blocked) {
    console.log("\n=== Walmart liveness ===\n");
    walmartResult = await runWalmartCheck({ listings });
  } else {
    console.error(
      "\nABORT: control TCIN read dead — soft-blocked. Walmart check skipped.",
    );
  }

  const prunePlan = computePrunePlan(
    catalog,
    {
      blocked: targetResult.blocked,
      target: { listings: targetResult.listings },
      walmart: { listings: walmartResult.listings },
    },
    {},
  );

  const report = {
    checked_at: new Date().toISOString(),
    blocked: targetResult.blocked,
    catalog_path: CATALOG_PATH,
    target: {
      control_results: targetResult.control_results,
      listings: targetResult.listings,
    },
    walmart: {
      listings: walmartResult.listings,
    },
    summary: buildSummary(
      targetResult.listings,
      walmartResult.listings,
      prunePlan,
      targetResult.blocked,
    ),
  };

  const reportPath = resolveFromRoot(REPORT_PATH);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  printSummary(report.summary, targetResult.blocked);
  console.log(`\nWrote ${REPORT_PATH}`);

  if (targetResult.blocked) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
