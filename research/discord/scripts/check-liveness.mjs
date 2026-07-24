// Throwaway: classify Target TCINs as live / delisted from raw PDP HTML.
// No browser and no API key needed — Target server-renders enough of the
// delisted page to distinguish it. Three independent signals must agree.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "research/discord";
const OUT = `${DIR}/liveness-target.json`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const DELAY_MS = 2000;
const CONTROL_EVERY = 20;
// Known-live first-party TCINs. If one of these ever reads dead we are being
// soft-blocked, and every later "dead" would be a false negative.
const CONTROLS = ["95230445", "95230447", "94681785"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function classify(html) {
  const unavailable = /currently unavailable/i.test(html);
  const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const title = og ? og[1].trim() : null;
  const marketplace = /sold\s+(?:and\s+shipped\s+)?by|target\s*\+|targetplus/i.test(html);

  if (unavailable && !title) return { status: "dead", title: null, marketplace: false };
  if (!unavailable && title) return { status: marketplace ? "live_marketplace" : "live", title, marketplace };
  // Signals disagree — never guess, because a wrong "dead" deletes a real product.
  return { status: "unclear", title, marketplace, note: `unavailable=${unavailable} title=${Boolean(title)}` };
}

async function fetchPdp(tcin) {
  const url = `https://www.target.com/p/-/A-${tcin}`;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
    const html = await res.text();
    return { ok: true, http: res.status, bytes: html.length, ...classify(html) };
  } catch (e) {
    return { ok: false, status: "unclear", title: null, note: String(e).slice(0, 80) };
  }
}

const rows = JSON.parse(readFileSync(`${DIR}/liveness-input.json`, "utf8"));
const targets = rows.filter((r) => r.retailer === "target").sort((a, b) => b.age - a.age);

const state = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : { checked_at: new Date().toISOString(), blocked: false, control_results: [], results: [] };
const done = new Set(state.results.map((r) => r.tcin));

const save = () => {
  state.checked_at = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(state, null, 2));
};

async function checkControl(position) {
  const tcin = CONTROLS[Math.floor(Math.random() * CONTROLS.length)];
  const r = await fetchPdp(tcin);
  state.control_results.push({ tcin, position, status: r.status, bytes: r.bytes });
  console.log(`  [control ${position}] ${tcin} -> ${r.status}`);
  if (r.status === "dead") {
    state.blocked = true;
    save();
    console.error(`\nABORT: control ${tcin} read dead — soft-blocked. Results after the last good control are untrustworthy.`);
    process.exit(2);
  }
  await sleep(DELAY_MS);
}

console.log(`checking ${targets.length} Target listings (${done.size} already done)\n`);
await checkControl("start");

let n = 0;
for (const t of targets) {
  if (done.has(t.sku)) continue;
  const r = await fetchPdp(t.sku);
  state.results.push({
    tcin: t.sku,
    status: r.status,
    title: r.title,
    marketplace: r.marketplace ?? false,
    bytes: r.bytes,
    age_days: t.age,
    name: t.name,
    ...(r.note ? { note: r.note } : {}),
  });
  n += 1;
  console.log(`${String(n).padStart(3)}/${targets.length - done.size}  ${t.sku.padEnd(11)} ${String(t.age).padStart(3)}d  ${r.status.padEnd(17)} ${(r.title ?? "").slice(0, 44)}`);
  if (n % 10 === 0) save();
  if (n % CONTROL_EVERY === 0) await checkControl(`after-${n}`);
  await sleep(DELAY_MS);
}

await checkControl("end");
save();

const counts = {};
for (const r of state.results) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log(`\ndone. ${JSON.stringify(counts)}`);
console.log(`controls: ${state.control_results.map((c) => c.status).join(", ")}`);
console.log(`wrote ${OUT}`);
