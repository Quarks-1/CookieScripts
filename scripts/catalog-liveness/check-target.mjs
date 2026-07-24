import {
  classifyTargetHtml,
  isBlockedByControls,
  TARGET_CONTROLS,
} from "./lib/classify-target.mjs";
import { USER_AGENT } from "./lib/paths.mjs";

const CONTROL_EVERY = 20;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} tcin
 * @returns {Promise<{ status: string, title: string | null, marketplace: boolean, bytes?: number, note?: string }>}
 */
async function fetchPdp(tcin) {
  const url = `https://www.target.com/p/-/A-${tcin}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      redirect: "follow",
    });
    const html = await res.text();
    return { bytes: html.length, ...classifyTargetHtml(html) };
  } catch (e) {
    return {
      status: "unclear",
      title: null,
      marketplace: false,
      bytes: 0,
      note: String(e).slice(0, 80),
    };
  }
}

/**
 * @param {string} position
 * @returns {Promise<{ tcin: string, position: string, status: string, bytes?: number, checked_at: string }>}
 */
async function checkControl(position) {
  const tcin = TARGET_CONTROLS[Math.floor(Math.random() * TARGET_CONTROLS.length)];
  const result = await fetchPdp(tcin);
  return {
    tcin,
    position,
    status: result.status,
    bytes: result.bytes,
    checked_at: new Date().toISOString(),
  };
}

/**
 * @param {{ listings: object[], delayMs?: number }} params
 * @returns {Promise<{ blocked: boolean, control_results: object[], listings: object[] }>}
 */
export async function runTargetCheck({ listings, delayMs = 2000 }) {
  const control_results = [];
  const results = [];
  let blocked = false;

  const runControl = async (position) => {
    const control = await checkControl(position);
    control_results.push(control);
    console.log(`  [control ${position}] ${control.tcin} -> ${control.status}`);
    if (control.status === "dead") {
      blocked = true;
      return true;
    }
    await sleep(delayMs);
    return false;
  };

  const targetListings = listings.filter((l) => l.retailer === "target");
  console.log(`checking ${targetListings.length} Target listings\n`);

  if (await runControl("start")) {
    return { blocked: true, control_results, listings: results };
  }

  let n = 0;
  for (const entry of targetListings) {
    const fetched = await fetchPdp(entry.sku);
    results.push({
      sku: entry.sku,
      status: fetched.status,
      title: fetched.title,
      marketplace: fetched.marketplace ?? false,
      bytes: fetched.bytes,
      checked_at: new Date().toISOString(),
      product_id: entry.product_id,
      product_name: entry.product_name,
      ...(fetched.note ? { note: fetched.note } : {}),
    });
    n += 1;
    console.log(
      `${String(n).padStart(3)}/${targetListings.length}  ${entry.sku.padEnd(11)} ${fetched.status.padEnd(17)} ${(fetched.title ?? "").slice(0, 44)}`,
    );
    if (n % CONTROL_EVERY === 0) {
      if (await runControl(`after-${n}`)) {
        return { blocked: true, control_results, listings: results };
      }
    }
    await sleep(delayMs);
  }

  if (await runControl("end")) {
    return { blocked: true, control_results, listings: results };
  }

  return { blocked: isBlockedByControls(control_results), control_results, listings: results };
}

import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { loadCatalogListings } = await import("./lib/catalog-listings.mjs");
  const { CATALOG_PATH } = await import("./lib/paths.mjs");
  try {
    const { listings } = loadCatalogListings(CATALOG_PATH);
    const result = await runTargetCheck({ listings });
    if (result.blocked) process.exit(2);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
