/**
 * Read-only Discord history harvester for seeding extension/core/data/catalog.json.
 *
 * Scans monitor channels for Target/Walmart product links, extracts TCINs and
 * item IDs alongside whatever titles and prices the monitor embeds carried, and
 * writes an aggregated report for manual review.
 *
 * Not shipped with the extension. Issues GET requests only.
 *
 *   export DISCORD_TOKEN='...'
 *   node scripts/discord-catalog-harvest.mjs --list-guilds
 *   node scripts/discord-catalog-harvest.mjs --list-channels <guildId>
 *   node scripts/discord-catalog-harvest.mjs --scan --channels <id>,<id> --since 2024-11-01
 *   node scripts/discord-catalog-harvest.mjs --aggregate
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";

const API = "https://discord.com/api/v10";
const DISCORD_EPOCH = 1420070400000n;
const OUT_DIR = "research/discord";
const CHECKPOINT = `${OUT_DIR}/checkpoint.json`;
const REPORT = `${OUT_DIR}/catalog-candidates.json`;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const SET_PATTERNS = [
  ["pitch-black", "Pitch Black", /pitch\s*black/i],
  ["chaos-rising", "Chaos Rising", /chaos\s*rising/i],
  ["perfect-order", "Perfect Order", /perfect\s*order/i],
  ["ascended-heroes", "Ascended Heroes", /ascended\s*heroes/i],
  ["phantasmal-flames", "Phantasmal Flames", /phantasmal\s*flames/i],
  ["prismatic-evolutions", "Prismatic Evolutions", /prismatic\s*evolutions?/i],
  ["surging-sparks", "Surging Sparks", /surging\s*sparks/i],
];

// Ordered most-specific first; the first match wins.
const TYPE_PATTERNS = [
  ["premium_checklane_blister", /premium\s*check\s*-?\s*lane/i],
  ["checklane_blister", /check\s*-?\s*lane/i],
  ["three_pack_blister", /(3|three)\s*-?\s*pack\s*blister/i],
  ["single_pack_blister", /(1|single|one)\s*-?\s*pack\s*blister/i],
  ["sleeved_booster_pack", /sleeved\s*booster/i],
  ["build_battle_box", /build\s*(&|and|\+)?\s*battle/i],
  ["elite_trainer_box", /elite\s*trainer\s*box|\betb\b/i],
  ["booster_bundle", /booster\s*bundle/i],
  ["booster_box", /booster\s*(box|display)/i],
  ["premium_collection", /(ultra|super)\s*-?\s*premium|premium\s*(figure|poster|collection)/i],
  ["special_box", /surprise\s*box|fun\s*pack|accessory\s*pouch/i],
  ["collection_box", /binder\s*collection|poster\s*collection|tech\s*sticker|collection\b/i],
  ["tin", /\btins?\b/i],
  ["booster_pack", /booster\s*pack/i],
];

function parseArgs(argv) {
  const args = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.values[name] = next;
      i += 1;
    } else {
      args.flags.add(name);
    }
  }
  return args;
}

function snowflakeFromDate(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${iso}`);
  return (BigInt(ms) - DISCORD_EPOCH) << 22n;
}

function dateFromSnowflake(id) {
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH)).toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs) {
  return Math.round(baseMs * (0.6 + Math.random() * 0.8));
}

function authHeader() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("DISCORD_TOKEN is not set. Export it and re-run; it is never written to disk.");
    process.exit(1);
  }
  const asBot = process.env.DISCORD_TOKEN_TYPE === "bot" || token.startsWith("Bot ");
  return asBot && !token.startsWith("Bot ") ? `Bot ${token}` : token;
}

class Throttle {
  constructor(baseDelayMs) {
    this.baseDelayMs = baseDelayMs;
    this.consecutive429 = 0;
    this.requests = 0;
  }

  async get(path) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await sleep(jitter(this.baseDelayMs));

      const response = await fetch(`${API}${path}`, {
        method: "GET",
        headers: {
          Authorization: authHeader(),
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });
      this.requests += 1;

      if (response.status === 401) {
        throw new Error("401 Unauthorized — the token is invalid or expired.");
      }
      if (response.status === 403) {
        return { forbidden: true, data: null };
      }
      if (response.status === 429) {
        this.consecutive429 += 1;
        if (this.consecutive429 >= 5) {
          throw new Error("Rate limited five times in a row. Stopping; raise --delay and resume.");
        }
        const body = await response.json().catch(() => ({}));
        const waitMs = Math.ceil((body.retry_after ?? 5) * 1000) + 1000;
        console.warn(`  429 received, backing off ${Math.round(waitMs / 1000)}s`);
        await sleep(waitMs * this.consecutive429);
        continue;
      }
      if (response.status >= 500) {
        const waitMs = 2000 * 2 ** attempt;
        console.warn(`  ${response.status} from Discord, retrying in ${waitMs / 1000}s`);
        await sleep(waitMs);
        continue;
      }
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} for ${path}`);
      }

      this.consecutive429 = 0;

      const remaining = Number(response.headers.get("x-ratelimit-remaining") ?? "1");
      const resetAfter = Number(response.headers.get("x-ratelimit-reset-after") ?? "0");
      if (remaining <= 0 && resetAfter > 0) {
        await sleep(Math.ceil(resetAfter * 1000) + 500);
      }

      return { forbidden: false, data: await response.json() };
    }
    throw new Error(`Gave up after repeated failures on ${path}`);
  }
}

function unwrapUrl(raw) {
  try {
    const parsed = new URL(raw);
    for (const key of ["u", "url", "r", "redirect", "target"]) {
      const nested = parsed.searchParams.get(key);
      if (nested && /^https?:\/\//i.test(nested)) return nested;
    }
    return raw;
  } catch {
    return raw;
  }
}

function extractSkus(url) {
  const unwrapped = unwrapUrl(url);
  let host;
  let pathname;
  try {
    const parsed = new URL(unwrapped);
    host = parsed.hostname.toLowerCase();
    pathname = parsed.pathname;
  } catch {
    return [];
  }

  if (host.endsWith("target.com")) {
    const match = pathname.match(/\/A-(\d+)/);
    return match ? [{ retailer: "target", sku: match[1] }] : [];
  }
  if (host.endsWith("walmart.com")) {
    const match = pathname.match(/\/ip\/(?:[^/]+\/)?(\d+)/);
    return match ? [{ retailer: "walmart", sku: match[1] }] : [];
  }
  return [];
}

function collectText(message) {
  const parts = [message.content ?? ""];
  for (const embed of message.embeds ?? []) {
    parts.push(embed.title ?? "", embed.description ?? "", embed.author?.name ?? "", embed.footer?.text ?? "");
    for (const field of embed.fields ?? []) {
      parts.push(field.name ?? "", field.value ?? "");
    }
  }
  return parts.filter(Boolean);
}

function collectUrls(message) {
  const urls = new Set();
  const pattern = /https?:\/\/[^\s<>()\][|"']+/gi;
  for (const text of collectText(message)) {
    for (const match of text.matchAll(pattern)) urls.add(match[0]);
  }
  for (const embed of message.embeds ?? []) {
    if (embed.url) urls.add(embed.url);
    for (const field of embed.fields ?? []) {
      for (const match of (field.value ?? "").matchAll(/\((https?:\/\/[^)]+)\)/gi)) urls.add(match[1]);
    }
  }
  return [...urls];
}

function bestTitle(message) {
  for (const embed of message.embeds ?? []) {
    if (embed.title) return embed.title.trim();
    const named = (embed.fields ?? []).find((f) => /^(product|item|name|title)$/i.test(f.name ?? ""));
    if (named?.value) return named.value.replace(/\[|\]\(.*\)/g, "").trim();
    if (embed.author?.name) return embed.author.name.trim();
  }
  const firstLine = (message.content ?? "")
    .split("\n")
    .map((line) => line.replace(/https?:\/\/\S+/gi, "").replace(/\s{2,}/g, " ").trim())
    .find((line) => line.length > 0);
  return firstLine ? firstLine.slice(0, 200) : null;
}

function extractPrices(message) {
  const prices = new Set();
  for (const text of collectText(message)) {
    for (const match of text.matchAll(/\$\s?(\d{1,4}(?:\.\d{2})?)/g)) {
      const cents = Math.round(Number(match[1]) * 100);
      if (cents > 0 && cents < 100000) prices.add(cents);
    }
  }
  return [...prices];
}

function guessSet(text) {
  for (const [id, name, pattern] of SET_PATTERNS) {
    if (pattern.test(text)) return { id, name };
  }
  return null;
}

function guessType(text) {
  for (const [type, pattern] of TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT)) return { channels: {} };
  return JSON.parse(readFileSync(CHECKPOINT, "utf8"));
}

function saveCheckpoint(checkpoint) {
  writeFileSync(CHECKPOINT, JSON.stringify(checkpoint, null, 2));
}

async function listGuilds(throttle) {
  const { data } = await throttle.get("/users/@me/guilds");
  for (const guild of data) {
    console.log(`${guild.id}  ${guild.name}`);
  }
}

async function listChannels(throttle, guildId) {
  const { data, forbidden } = await throttle.get(`/guilds/${guildId}/channels`);
  if (forbidden) {
    console.error("403 — no permission to list channels on that guild.");
    return;
  }
  for (const channel of data.filter((c) => c.type === 0 || c.type === 5)) {
    console.log(`${channel.id}  #${channel.name}`);
  }
}

async function scanChannel(throttle, channelId, cutoff, checkpoint) {
  const rawPath = `${OUT_DIR}/raw-${channelId}.ndjson`;
  const state = checkpoint.channels[channelId] ?? { before: null, messages: 0, done: false };
  if (state.done) {
    console.log(`#${channelId} already complete (${state.messages} messages), skipping`);
    return;
  }

  console.log(`Scanning channel ${channelId}${state.before ? ` (resuming at ${state.before})` : ""}`);

  for (;;) {
    const query = state.before ? `?limit=100&before=${state.before}` : "?limit=100";
    const { data, forbidden } = await throttle.get(`/channels/${channelId}/messages${query}`);

    if (forbidden) {
      console.warn(`  403 — no read access to ${channelId}, skipping`);
      state.done = true;
      break;
    }
    if (!Array.isArray(data) || data.length === 0) {
      state.done = true;
      break;
    }

    const lines = data.map((message) => JSON.stringify({
      id: message.id,
      channel_id: channelId,
      timestamp: message.timestamp,
      author: message.author?.username ?? null,
      bot: message.author?.bot ?? false,
      content: message.content ?? "",
      embeds: message.embeds ?? [],
    }));
    appendFileSync(rawPath, `${lines.join("\n")}\n`);

    state.messages += data.length;
    const oldest = data[data.length - 1];
    state.before = oldest.id;

    checkpoint.channels[channelId] = state;
    saveCheckpoint(checkpoint);

    const oldestDate = dateFromSnowflake(oldest.id);
    console.log(`  +${data.length} (${state.messages} total) back to ${oldestDate.slice(0, 10)}`);

    if (BigInt(oldest.id) <= cutoff) {
      state.done = true;
      break;
    }
    if (data.length < 100) {
      state.done = true;
      break;
    }
  }

  checkpoint.channels[channelId] = state;
  saveCheckpoint(checkpoint);
}

async function readNdjson(path, onRecord) {
  const stream = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of stream) {
    if (!line.trim()) continue;
    try {
      onRecord(JSON.parse(line));
    } catch {
      // Skip a truncated trailing line from an interrupted run.
    }
  }
}

async function aggregate(cutoffIso) {
  if (!existsSync(OUT_DIR)) {
    console.error(`No ${OUT_DIR} directory. Run a scan first.`);
    process.exit(1);
  }
  const files = readdirSync(OUT_DIR).filter((f) => f.startsWith("raw-") && f.endsWith(".ndjson"));
  if (files.length === 0) {
    console.error("No raw-*.ndjson files found. Run a scan first.");
    process.exit(1);
  }

  const byKey = new Map();
  let messages = 0;
  let seenIds = new Set();

  for (const file of files) {
    await readNdjson(`${OUT_DIR}/${file}`, (message) => {
      if (seenIds.has(message.id)) return;
      seenIds.add(message.id);
      messages += 1;

      if (cutoffIso && message.timestamp < cutoffIso) return;

      const urls = collectUrls(message);
      if (urls.length === 0) return;

      const title = bestTitle(message);
      const prices = extractPrices(message);
      const haystack = [title ?? "", ...collectText(message)].join(" ");

      for (const url of urls) {
        for (const { retailer, sku } of extractSkus(url)) {
          const key = `${retailer}:${sku}`;
          let record = byKey.get(key);
          if (!record) {
            record = {
              retailer,
              sku,
              hits: 0,
              titles: {},
              prices_seen: new Set(),
              first_seen: message.timestamp,
              last_seen: message.timestamp,
              sample_urls: new Set(),
              set_guess: null,
              type_guess: null,
            };
            byKey.set(key, record);
          }
          record.hits += 1;
          if (title) record.titles[title] = (record.titles[title] ?? 0) + 1;
          for (const price of prices) record.prices_seen.add(price);
          if (record.sample_urls.size < 3) record.sample_urls.add(unwrapUrl(url));
          if (message.timestamp < record.first_seen) record.first_seen = message.timestamp;
          if (message.timestamp > record.last_seen) record.last_seen = message.timestamp;
          record.set_guess = record.set_guess ?? guessSet(haystack);
          record.type_guess = record.type_guess ?? guessType(haystack);
        }
      }
    });
  }

  const products = [...byKey.values()]
    .map((record) => {
      const titles = Object.entries(record.titles).sort((a, b) => b[1] - a[1]);
      return {
        retailer: record.retailer,
        sku: record.sku,
        best_title: titles[0]?.[0] ?? null,
        set_guess: record.set_guess,
        type_guess: record.type_guess,
        hits: record.hits,
        prices_seen: [...record.prices_seen].sort((a, b) => a - b),
        first_seen: record.first_seen,
        last_seen: record.last_seen,
        all_titles: titles.slice(0, 5).map(([text, count]) => ({ text, count })),
        sample_urls: [...record.sample_urls],
      };
    })
    .sort((a, b) => {
      const setA = a.set_guess?.id ?? "zzz";
      const setB = b.set_guess?.id ?? "zzz";
      if (setA !== setB) return setA.localeCompare(setB);
      if (a.retailer !== b.retailer) return a.retailer.localeCompare(b.retailer);
      return b.hits - a.hits;
    });

  const matched = products.filter((p) => p.set_guess !== null);
  const report = {
    generated_at: new Date().toISOString(),
    messages_scanned: messages,
    channels: files.length,
    totals: {
      unique_skus: products.length,
      matched_to_a_known_set: matched.length,
      target: products.filter((p) => p.retailer === "target").length,
      walmart: products.filter((p) => p.retailer === "walmart").length,
    },
    products,
  };

  writeFileSync(REPORT, JSON.stringify(report, null, 2));

  console.log(`\nScanned ${messages} messages across ${files.length} channel file(s)`);
  console.log(`Found ${products.length} unique SKUs (${report.totals.target} Target, ${report.totals.walmart} Walmart)`);
  console.log(`${matched.length} matched one of the 7 known sets`);
  console.log(`Wrote ${REPORT}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const throttle = new Throttle(Number(args.values.delay ?? 2500));

  mkdirSync(OUT_DIR, { recursive: true });

  if (args.flags.has("list-guilds")) {
    await listGuilds(throttle);
    return;
  }
  if (args.values["list-channels"]) {
    await listChannels(throttle, args.values["list-channels"]);
    return;
  }

  const sinceIso = `${args.values.since ?? "2024-11-01"}T00:00:00.000Z`;

  if (args.flags.has("aggregate")) {
    await aggregate(sinceIso);
    return;
  }

  if (!args.flags.has("scan")) {
    console.log("Usage:");
    console.log("  --list-guilds");
    console.log("  --list-channels <guildId>");
    console.log("  --scan --channels <id>,<id> [--since 2024-11-01] [--delay 2500]");
    console.log("  --aggregate");
    return;
  }

  const channels = (args.values.channels ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  if (channels.length === 0) {
    console.error("--scan requires --channels <id>,<id>");
    process.exit(1);
  }

  const cutoff = snowflakeFromDate(sinceIso);
  const checkpoint = loadCheckpoint();

  console.log(`Scanning ${channels.length} channel(s) back to ${sinceIso.slice(0, 10)}`);
  console.log(`Throttle: ~${throttle.baseDelayMs}ms between requests with jitter\n`);

  for (const channelId of channels) {
    await scanChannel(throttle, channelId, cutoff, checkpoint);
  }

  console.log(`\n${throttle.requests} requests issued. Aggregating...`);
  await aggregate(sinceIso);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  console.error("Progress is checkpointed — re-run the same command to resume.");
  process.exit(1);
});
