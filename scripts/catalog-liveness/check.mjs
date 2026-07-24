#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { runTargetCheck } from "./check-target.mjs";
import { loadCatalogListings } from "./lib/catalog-listings.mjs";
import { computePrunePlan } from "./lib/prune-policy.mjs";
import { CATALOG_PATH, REPORT_PATH, resolveFromRoot } from "./lib/paths.mjs";

/**
 * @param {object[]} targetListings
 * @param {{ removed_listings: object[], removed_products: object[] }} prunePlan
 * @param {boolean} blocked
 */
function buildSummary(targetListings, prunePlan, blocked) {
  const summary = {
    target: { dead: 0, live: 0, live_marketplace: 0, unclear: 0 },
    prunable_listings: blocked ? 0 : prunePlan.removed_listings.length,
    prunable_products: blocked ? 0 : prunePlan.removed_products.length,
  };

  for (const entry of targetListings) {
    if (entry.status in summary.target) {
      summary.target[entry.status] += 1;
    }
  }

  return summary;
}

function printSummary(summary, blocked) {
  console.log("\n--- Catalog Liveness Summary ---");
  console.log(`Target: ${JSON.stringify(summary.target)}`);
  if (blocked) {
    console.log("BLOCKED: control TCIN read dead — prunable counts zeroed");
  } else {
    console.log(
      `Prunable: ${summary.prunable_listings} listing(s), ${summary.prunable_products} product(s)`,
    );
  }
  console.log("(Walmart liveness checks are not run yet.)");
}

async function main() {
  const { catalog, listings } = loadCatalogListings(CATALOG_PATH);

  console.log("=== Target liveness ===\n");
  const targetResult = await runTargetCheck({ listings });

  if (targetResult.blocked) {
    console.error("\nABORT: control TCIN read dead — soft-blocked.");
  }

  const prunePlan = computePrunePlan(
    catalog,
    {
      blocked: targetResult.blocked,
      target: { listings: targetResult.listings },
      walmart: { listings: [] },
    },
    {},
  );

  const report = {
    checked_at: new Date().toISOString(),
    blocked: targetResult.blocked,
    catalog_path: CATALOG_PATH,
    retailers_checked: ["target"],
    target: {
      control_results: targetResult.control_results,
      listings: targetResult.listings,
    },
    walmart: {
      skipped: true,
      listings: [],
    },
    summary: buildSummary(targetResult.listings, prunePlan, targetResult.blocked),
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
