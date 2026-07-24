// Throwaway: systematic product-name cleanup on the catalog draft.
// Deliberately conservative — it only strips patterns that are provably noise
// (set codes, era prefixes, leading punctuation, casing), never distinguishing
// detail like character or series names.
// Reconcile already normalizes before grouping; this now runs as a verification
// pass and should report zero renames.
import { readFileSync, writeFileSync } from "node:fs";
import { makeNormalizer } from "./normalize.mjs";

const DIR = "research/discord";
const draft = JSON.parse(readFileSync(`${DIR}/catalog-draft.json`, "utf8"));
const setNames = draft.sets.map((s) => s.name);
const normalize = makeNormalizer(setNames);

const changes = [];
for (const p of draft.products) {
  const next = normalize(p.name);
  if (next !== p.name) {
    changes.push({ from: p.name, to: next, skus: p.listings.map((l) => `${l.retailer}:${l.sku}`) });
    p.name = next;
  }
}

// A rename must never make two distinct products indistinguishable in the picker.
const byName = new Map();
for (const p of draft.products) {
  const key = `${p.name.toLowerCase()}::${p.type}`;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(p);
}
const collisions = [...byName.entries()]
  .filter(([, v]) => v.length > 1)
  .map(([key, v]) => ({ key, count: v.length, skus: v.flatMap((p) => p.listings.map((l) => `${l.retailer}:${l.sku}`)) }));

writeFileSync(`${DIR}/catalog-draft.json`, JSON.stringify(draft, null, 2));
writeFileSync(`${DIR}/name-changes.json`, JSON.stringify({ changes, collisions }, null, 2));

console.log(`renamed ${changes.length} of ${draft.products.length} products`);
console.log(`duplicate display names after rename: ${collisions.length}`);
console.log("\nsample renames:");
for (const c of changes.slice(0, 14)) console.log(`  "${c.from}"\n    -> "${c.to}"`);
if (collisions.length) {
  console.log("\ncollisions needing disambiguation:");
  for (const c of collisions.slice(0, 12)) console.log(`  x${c.count}  ${c.key.split("::")[0]}  [${c.skus.join(" ")}]`);
}
