#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { loadCatalogListings } from "./lib/catalog-listings.mjs";
import { computePrunePlan } from "./lib/prune-policy.mjs";
import { CATALOG_PATH, REPORT_PATH, resolveFromRoot } from "./lib/paths.mjs";

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: !argv.includes("--apply"),
    json: argv.includes("--json"),
    dropMarketplace: argv.includes("--drop-marketplace"),
  };
}

function printHumanSummary(plan) {
  if (!plan.changes) {
    console.log("No prunable listings found.");
    return;
  }
  console.log(
    `Would remove ${plan.removed_listings.length} listing(s) and ${plan.removed_products.length} product(s):`,
  );
  for (const entry of plan.removed_listings) {
    console.log(
      `  - [${entry.retailer}] ${entry.sku} (${entry.product_name}) — ${entry.status}`,
    );
  }
  for (const product of plan.removed_products) {
    console.log(`  - product: ${product.id} (${product.name})`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = resolveFromRoot(REPORT_PATH);
  const catalogPath = resolveFromRoot(CATALOG_PATH);

  if (!existsSync(reportPath)) {
    const empty = {
      changes: false,
      prunable_listings: 0,
      prunable_products: 0,
      removed_listings: [],
      removed_products: [],
    };
    if (args.json) {
      console.log(JSON.stringify(empty));
    } else {
      console.log("No liveness report found. Run npm run catalog:liveness first.");
    }
    process.exit(0);
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8"));

  if (report.blocked) {
    console.error("Report is blocked (control TCIN dead). Refusing to prune catalog.");
    process.exit(1);
  }

  const { catalog } = loadCatalogListings(catalogPath);
  const plan = computePrunePlan(catalog, report, {
    dropMarketplace: args.dropMarketplace,
  });

  const output = {
    changes: plan.changes,
    prunable_listings: plan.removed_listings.length,
    prunable_products: plan.removed_products.length,
    removed_listings: plan.removed_listings,
    removed_products: plan.removed_products,
  };

  if (args.json) {
    console.log(JSON.stringify(output));
  } else if (args.dryRun) {
    printHumanSummary(plan);
  }

  if (args.apply) {
    if (!plan.changes) {
      if (!args.json) console.log("Nothing to apply.");
      process.exit(0);
    }
    writeFileSync(catalogPath, `${JSON.stringify(plan.prunedCatalog, null, 2)}\n`);
    if (!args.json) {
      console.log(`Applied prune to ${CATALOG_PATH}`);
    }
  }

  process.exit(0);
}

main();
