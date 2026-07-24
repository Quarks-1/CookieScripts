// Throwaway: validate Walmart item IDs and verify product identity.
// Walmart answers /ip/<id> with a 301 whose headers carry both a validity flag
// and the canonical SEO slug, so headers alone give liveness AND the real
// product name — no body fetch, no bot-detection surface.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "research/discord";
const OUT = `${DIR}/liveness-walmart.json`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STOP = new Set([
  "pokemon", "tcg", "trading", "card", "game", "the", "and", "set", "pack", "packs",
  "box", "collection", "scarlet", "violet", "sword", "shield", "promo", "cards", "card",
]);

const tokens = (s) =>
  new Set(
    s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t.length > 2 && !STOP.has(t)),
  );

// Jaccard-style overlap on distinguishing words only. Generic retail filler is
// stripped first so "Pokemon TCG ... Box" alone can never look like a match.
function similarity(ourName, slug) {
  const a = tokens(ourName);
  const b = tokens(slug.replace(/^\/ip\//, "").replace(/\/\d+$/, "").replace(/-/g, " "));
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / a.size;
}

async function probe(itemId) {
  try {
    const res = await fetch(`https://www.walmart.com/ip/${itemId}`, {
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
      redirect: "manual",
    });
    const valid = res.headers.get("x-usgm-validitemid");
    const seo = res.headers.get("x-usgm-item-seo-url") ?? res.headers.get("location");
    return { http: res.status, valid: valid === "true", seo: seo ?? null, routing: res.headers.get("x-usgm-routing") };
  } catch (e) {
    return { http: 0, valid: null, seo: null, error: String(e).slice(0, 80) };
  }
}

const draft = JSON.parse(readFileSync(`${DIR}/catalog-draft.json`, "utf8"));
const listings = [];
for (const p of draft.products) {
  for (const l of p.listings) if (l.retailer === "walmart") listings.push({ sku: l.sku, name: p.name, type: p.type });
}

const state = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : { checked_at: new Date().toISOString(), results: [] };
const done = new Set(state.results.map((r) => r.sku));
const save = () => {
  state.checked_at = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(state, null, 2));
};

console.log(`checking ${listings.length} Walmart listings (${done.size} already done)\n`);

let n = 0;
for (const l of listings) {
  if (done.has(l.sku)) continue;
  const r = await probe(l.sku);
  const sim = r.seo ? similarity(l.name, r.seo) : 0;
  const status = r.valid === true ? "valid" : r.valid === false ? "invalid" : "unclear";
  const mismatch = status === "valid" && sim < 0.34;
  state.results.push({
    sku: l.sku,
    status,
    our_name: l.name,
    walmart_slug: r.seo ? r.seo.replace(/^\/ip\//, "").replace(/\/\d+$/, "").replace(/-/g, " ") : null,
    similarity: Number(sim.toFixed(2)),
    identity_mismatch: mismatch,
    http: r.http,
    ...(r.error ? { error: r.error } : {}),
  });
  n += 1;
  const flag = status !== "valid" ? "  <<< " + status.toUpperCase() : mismatch ? "  <<< NAME MISMATCH" : "";
  console.log(`${String(n).padStart(3)}/${listings.length - done.size}  ${l.sku.padEnd(13)} ${status.padEnd(8)} sim=${sim.toFixed(2)}  ${l.name.slice(0, 38).padEnd(40)}${flag}`);
  if (n % 10 === 0) save();
  await sleep(DELAY_MS);
}
save();

const counts = {};
for (const r of state.results) counts[r.status] = (counts[r.status] ?? 0) + 1;
const mismatches = state.results.filter((r) => r.identity_mismatch);
console.log(`\ndone. ${JSON.stringify(counts)}`);
console.log(`identity mismatches needing review: ${mismatches.length}`);
for (const m of mismatches) console.log(`  ${m.sku}  ours="${m.our_name}"  walmart="${m.walmart_slug}"`);
console.log(`wrote ${OUT}`);
