// Throwaway reconciliation: curated triage + composition research -> catalog draft.
// Lives under research/ (gitignored) because it is a one-time data pass, not a repo tool.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { makeNormalizer } from "./normalize.mjs";

const DIR = "research/discord";
const read = (f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));

const sets = read("sets.json");
const target = read("curated-target.json");
const walmart = read("curated-walmart.json");
const compositions = [1, 2, 3].flatMap((i) => read(`composition-${i}.json`).products);

// Real sets the inventory pass missed. Both are referenced by products, so
// without them those references would be silently dropped.
const MISSING_SETS = [
  { id: "scarlet-violet", name: "Scarlet & Violet", released_on: "2023-03-31", date_confidence: "confirmed", source: "added during reconciliation; SV01 base set", era: "Scarlet & Violet" },
  { id: "evolving-skies", name: "Evolving Skies", released_on: "2021-08-27", date_confidence: "confirmed", source: "added during reconciliation; SWSH7", era: "Sword & Shield" },
];
for (const s of MISSING_SETS) {
  if (!sets.sets.some((x) => x.name === s.name)) sets.sets.push(s);
}

const setId = (name) => {
  const hit = sets.sets.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return hit ? hit.id : null;
};

// Ground truth beats both passes. Sourced from the plan's confirmed compositions
// plus the user-supplied SKU list.
const GROUND_TRUTH = {
  "94636854": { contents: [["Black Bolt", 2], ["White Flare", 2]], confidence: "confirmed" },
  "94681790": {
    contents: [["Destined Rivals", 4], ["Phantasmal Flames", 4], ["Mega Evolution", 4], ["Journey Together", 4], ["Surging Sparks", 2]],
    confidence: "confirmed",
    note: "18 packs total",
  },
  "95225595": { contents: [["Ascended Heroes", 2]], confidence: "confirmed", note: "Series 1" },
  "1011209279": { contents: [["Perfect Order", 1], ["Chaos Rising", 1]], confidence: "confirmed", note: "Series 2" },
  "1011960739": { contents: [], confidence: "unknown", note: "Series 3 contents unannounced" },
  "95138464": { contents: [["Phantasmal Flames", 2], ["Mega Evolution", 1], ["Destined Rivals", 1]], confidence: "likely" },
  "1012055696": { contents: [["Prismatic Evolutions", 15]], confidence: "confirmed" },
  "94411709": { contents: [], confidence: "unknown", note: "Packs May Vary" },
  "94411684": { contents: [], confidence: "unknown", note: "Packs May Vary" },
  "94411690": { contents: [], confidence: "unknown", note: "Packs May Vary" },
  "94827556": {
    contents: [["Destined Rivals", null], ["Journey Together", null]],
    confidence: "likely",
    note: "user-confirmed as mixed Destined Rivals + Journey Together; per-set pack counts unverified",
  },
};

// The three First Partner Illustration Collections are distinct products whose
// series numbers were lost in curation, collapsing them into one display name.
const RENAME = {
  "95225595": "First Partner Illustration Collection - Series 1",
  "1011209279": "First Partner Illustration Collection - Series 2",
  "1011960739": "First Partner Illustration Collection - Series 3",
};

// The Target pass excluded this as "monitor noise" while keeping its two
// identically-titled siblings. Restore it for consistency.
const RESTORE = {
  "94411709": { name: "Stacking Tin - Ogerpon", type: "tin", msrp_cents: 1499, msrp_confidence: "inferred", hits: 0, first_seen: "2025-03-07" },
  // Never appeared in the harvest at all, in either the keep or exclude list.
  "94827556": { name: "Reshiram ex Box", type: "collection_box", msrp_cents: 1999, msrp_confidence: "inferred", hits: 0, first_seen: "2025-05-30" },
};

const log = { merged: [], refusedMerge: [], groundTruthApplied: [], unresolvedSets: {}, restored: [] };

// 1. Flatten both retailers into listing records.
const records = [];
for (const [retailer, src] of [["target", target], ["walmart", walmart]]) {
  for (const k of src.kept) records.push({ retailer, ...k });
}
for (const [sku, extra] of Object.entries(RESTORE)) {
  if (!records.some((r) => r.retailer === "target" && r.sku === sku)) {
    records.push({ retailer: "target", sku, ...extra });
    log.restored.push(sku);
  }
}

// 1b. Apply Target liveness: drop delisted TCINs and Target Plus marketplace
// listings. Done before the merge below so duplicate-name groups that only
// existed because of dead/marketplace variants collapse on their own.
if (existsSync(`${DIR}/liveness-target.json`)) {
  const live = JSON.parse(readFileSync(`${DIR}/liveness-target.json`, "utf8"));
  if (live.blocked) throw new Error("liveness-target.json is marked blocked; its dead verdicts are untrustworthy");
  const status = new Map(live.results.map((r) => [r.tcin, r.status]));
  let dropped = 0, droppedMarketplace = 0;
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const r = records[i];
    if (r.retailer !== "target") continue;
    const s = status.get(r.sku);
    if (s === "dead") {
      records.splice(i, 1);
      dropped += 1;
    } else if (s === "live_marketplace") {
      records.splice(i, 1);
      droppedMarketplace += 1;
    }
  }
  log.liveness = {
    dropped,
    droppedMarketplace,
    unchecked: records.filter((r) => r.retailer === "target" && !status.has(r.sku)).length,
  };
}

// Normalize before grouping, so names that only become identical after cleanup
// still merge (otherwise "TCG: X Mini Tin" and "X Mini Tin" stay separate rows).
const normalizeName = makeNormalizer(sets.sets.map((s) => s.name));
for (const r of records) {
  r.name = RENAME[r.sku] && r.retailer === "target" ? RENAME[r.sku] : normalizeName(r.name);
}

// 2. Index composition research by sku.
const compBySku = new Map();
for (const p of compositions) {
  for (const l of p.listings ?? []) compBySku.set(l.sku, p);
}

// 3. Resolve contents per listing: ground truth > research > title-derived.
const toContents = (pairs) => pairs.map(([name, packs]) => (packs == null ? { set_name: name } : { set_name: name, packs }));

for (const r of records) {
  const gt = GROUND_TRUTH[r.sku];
  const comp = compBySku.get(r.sku);
  if (gt) {
    r.contents = toContents(gt.contents);
    r.contents_confidence = gt.confidence;
    r.contents_source = "ground truth";
    if (gt.note) r.contents_note = gt.note;
    log.groundTruthApplied.push(r.sku);
  } else if (comp) {
    r.contents = (comp.contents ?? []).map((c) => (c.packs == null ? { set_name: c.set_name } : { set_name: c.set_name, packs: c.packs }));
    r.contents_confidence = comp.confidence ?? "unknown";
    r.contents_source = comp.source ?? "research";
    if (comp.notes) r.contents_note = comp.notes;
  } else {
    // Pack-shaped types the research pass skipped: the set name is the product name.
    r.contents = (r.set_names ?? []).map((n) => ({ set_name: n }));
    r.contents_confidence = r.contents.length ? "likely" : "unknown";
    r.contents_source = "title-derived";
  }
  delete r.set_names;
}

// 4. Map set names to ids, dropping anything unresolvable.
for (const r of records) {
  const resolved = [];
  for (const c of r.contents) {
    const id = setId(c.set_name);
    if (!id) {
      log.unresolvedSets[c.set_name] = (log.unresolvedSets[c.set_name] ?? 0) + 1;
      continue;
    }
    resolved.push(c.packs == null ? { set_id: id } : { set_id: id, packs: c.packs });
  }
  r.contents = resolved;
}

// 5. Merge cross-retailer duplicates, but only when it is provably safe.
const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sig = (c) => JSON.stringify(c.map((x) => x.set_id).sort());

const groups = new Map();
for (const r of records) {
  const key = `${norm(r.name)}::${r.type}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const products = [];
for (const [key, rows] of groups) {
  // A product may legitimately hold several SKUs at one retailer: relisted TCINs,
  // per-artwork pack variants, and multiple Target Plus sellers of the same item.
  // Differing contents still mean differing products (this is what fused First
  // Partner S1 and S3), so that remains the one reason to refuse a merge.
  const sigs = new Set(rows.map((r) => sig(r.contents)).filter((s) => s !== "[]"));
  const contentsConflict = sigs.size > 1;

  if (rows.length > 1 && contentsConflict) {
    log.refusedMerge.push({ key, reason: "contents conflict", skus: rows.map((r) => `${r.retailer}:${r.sku}`) });
    for (const r of rows) products.push(single(r));
    continue;
  }

  if (rows.length > 1) log.merged.push({ key, skus: rows.map((r) => `${r.retailer}:${r.sku}`) });
  const best = rows.find((r) => r.contents.length > 0) ?? rows[0];
  products.push({
    name: best.name,
    type: best.type,
    contents: best.contents,
    contents_confidence: best.contents_confidence,
    contents_source: best.contents_source,
    ...(best.contents_note ? { contents_note: best.contents_note } : {}),
    msrp_cents: Math.min(...rows.map((r) => r.msrp_cents).filter((n) => typeof n === "number" && n > 0)),
    msrp_confidence: best.msrp_confidence,
    hits: rows.reduce((a, r) => a + (r.hits ?? 0), 0),
    listings: rows.map(listingOf),
  });
}

function listingOf(r) {
  return { retailer: r.retailer, sku: r.sku, ...(r.marketplace ? { marketplace: true } : {}) };
}

function single(r) {
  return {
    name: r.name,
    type: r.type,
    contents: r.contents,
    contents_confidence: r.contents_confidence,
    contents_source: r.contents_source,
    ...(r.contents_note ? { contents_note: r.contents_note } : {}),
    msrp_cents: r.msrp_cents,
    msrp_confidence: r.msrp_confidence,
    hits: r.hits ?? 0,
    listings: [listingOf(r)],
  };
}

products.sort((a, b) => b.hits - a.hits);

// Liveness pruning can empty a set entirely (every product dead or marketplace-only).
// Shipping those would render empty groups in the picker.
const referenced = new Set(products.flatMap((p) => p.contents.map((c) => c.set_id)));
const liveSets = sets.sets.filter((s) => referenced.has(s.id));
log.prunedSets = sets.sets.filter((s) => !referenced.has(s.id)).map((s) => s.name);

writeFileSync(
  `${DIR}/catalog-draft.json`,
  JSON.stringify({ generated_at: new Date().toISOString(), sets: liveSets, products }, null, 2),
);
writeFileSync(`${DIR}/reconcile-log.json`, JSON.stringify(log, null, 2));

const multi = products.filter((p) => p.contents.length > 1);
const empty = products.filter((p) => p.contents.length === 0);
const dual = products.filter((p) => p.listings.length > 1);
const conf = {};
for (const p of products) conf[p.contents_confidence] = (conf[p.contents_confidence] ?? 0) + 1;

console.log(`listings in: ${records.length}`);
console.log(`products out: ${products.length}`);
console.log(`  dual-retailer: ${dual.length}`);
console.log(`  multi-set: ${multi.length}`);
console.log(`  empty contents (-> assorted): ${empty.length}`);
console.log(`  confidence: ${JSON.stringify(conf)}`);
console.log(`sets: ${sets.sets.length}`);
console.log(`merged: ${log.merged.length}  refused: ${log.refusedMerge.length}  restored: ${log.restored.length}`);
console.log(`ground truth applied: ${log.groundTruthApplied.length}`);
console.log(`unresolved set names: ${JSON.stringify(log.unresolvedSets)}`);
const totalListings = products.reduce((a, p) => a + p.listings.length, 0);
console.log(`listing conservation: ${totalListings} (expect ${records.length}) ${totalListings === records.length ? "OK" : "MISMATCH"}`);
