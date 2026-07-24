/**
 * Triage research/discord/slim-target.ndjson into curated-target.json.
 * Run: node scripts/curate-target-catalog.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const INPUT = "research/discord/slim-target.ndjson";
const OUTPUT = "research/discord/curated-target.json";

const KNOWN_SETS = [
  "Perfect Order",
  "Chaos Rising",
  "Pitch Black",
  "Ascended Heroes",
  "Phantasmal Flames",
  "Mega Evolution",
  "Black Bolt",
  "White Flare",
  "Destined Rivals",
  "Journey Together",
  "Prismatic Evolutions",
  "Surging Sparks",
  "Stellar Crown",
  "Twilight Masquerade",
  "Temporal Forces",
  "Paradox Rift",
  "Paldean Fates",
  "Crown Zenith",
  "Shrouded Fable",
  "Paldea Evolved",
  "Scarlet & Violet",
  "Lost Origin",
  "Silver Tempest",
  "Brilliant Stars",
  "Astral Radiance",
  "Fusion Strike",
  "Vivid Voltage",
  "Chilling Reign",
  "Evolving Skies",
  "Shining Fates",
  "151",
  "Unova",
];

const SET_PATTERNS = [
  [/perfect\s*order/i, "Perfect Order"],
  [/chaos\s*rising/i, "Chaos Rising"],
  [/pitch\s*black/i, "Pitch Black"],
  [/ascended\s*heroes/i, "Ascended Heroes"],
  [/phantasmal\s*flames/i, "Phantasmal Flames"],
  [/black\s*bolt/i, "Black Bolt"],
  [/white\s*flare/i, "White Flare"],
  [/destined\s*rivals/i, "Destined Rivals"],
  [/journey\s*together/i, "Journey Together"],
  [/prismatic\s*evolutions?/i, "Prismatic Evolutions"],
  [/surging\s*sparks/i, "Surging Sparks"],
  [/stellar\s*crown/i, "Stellar Crown"],
  [/twilight\s*masquerade/i, "Twilight Masquerade"],
  [/temporal\s*forces/i, "Temporal Forces"],
  [/paradox\s*rift/i, "Paradox Rift"],
  [/paldean\s*fates/i, "Paldean Fates"],
  [/crown\s*zenith/i, "Crown Zenith"],
  [/shrouded\s*fable/i, "Shrouded Fable"],
  [/paldea\s*evolved/i, "Paldea Evolved"],
  [/lost\s*origin/i, "Lost Origin"],
  [/silver\s*tempest/i, "Silver Tempest"],
  [/brilliant\s*stars/i, "Brilliant Stars"],
  [/astral\s*radiance/i, "Astral Radiance"],
  [/fusion\s*strike/i, "Fusion Strike"],
  [/vivid\s*voltage/i, "Vivid Voltage"],
  [/chilling\s*reign/i, "Chilling Reign"],
  [/evolving\s*skies/i, "Evolving Skies"],
  [/shining\s*fates/i, "Shining Fates"],
  [/scarlet\s*&?\s*violet\s*151|\b151\b(?!\s*pieces)/i, "151"],
  [/mega\s*evolution/i, "Mega Evolution"],
  [/unova/i, "Unova"],
  [/scarlet\s*&?\s*violet(?!\s*151)/i, "Scarlet & Violet"],
];

// SKU -> { action: 'keep'|'exclude', ...overrides }
const SKU_OVERRIDES = {
  // Noise / junk titles
  94681772: { action: "exclude", reason: "monitor noise (truncated title)" },
  94681764: { action: "exclude", reason: "monitor noise (truncated title)" },
  94681771: { action: "exclude", reason: "monitor noise (truncated title)" },
  94681775: { action: "exclude", reason: "monitor noise (truncated title)" },
  94681769: { action: "exclude", reason: "monitor noise (truncated title)" },
  94411702: { action: "exclude", reason: "monitor noise (generic Target title)" },
  94411699: { action: "exclude", reason: "monitor noise (generic Target title)" },
  94411682: { action: "exclude", reason: "monitor noise (generic Target title)" },
  94411709: { action: "exclude", reason: "monitor noise (generic Target title)" },
  94411696: { action: "exclude", reason: "monitor noise (generic Target title)" },
  94411703: { action: "exclude", reason: "monitor noise (generic Target title)" },
  94411693: { action: "exclude", reason: "monitor noise (generic Target title)" },
  94681763: {
    action: "keep",
    name: "Mega Latias ex Box",
    type: "collection_box",
    set_names: ["Mega Evolution"],
  },
  94681782: {
    action: "keep",
    name: "Mega Evolution Booster Bundle",
    type: "booster_bundle",
    set_names: ["Mega Evolution"],
  },
  95230446: {
    action: "keep",
    name: "Perfect Order Three-Booster Blister",
    type: "three_pack_blister",
    set_names: ["Perfect Order"],
  },
  95225595: {
    action: "keep",
    name: "Perfect Order First Partner Illustration Collection",
    type: "collection_box",
    set_names: ["Perfect Order"],
  },
  1011206804: {
    action: "keep",
    name: "Prismatic Evolutions Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["Prismatic Evolutions"],
  },
  94827546: {
    action: "keep",
    name: "Black Kyurem ex & Melmetal ex Box",
    type: "collection_box",
    set_names: [],
  },
  94827540: {
    action: "keep",
    name: "Archaludon ex & Reshiram ex Box",
    type: "collection_box",
    set_names: [],
  },
  94411686: {
    action: "keep",
    name: "Charizard ex Special Collection",
    type: "collection_box",
    set_names: [],
  },
  94411701: {
    action: "keep",
    name: "Iono's Bellibolt ex Premium Collection",
    type: "premium_collection",
    set_names: [],
  },
  94411680: {
    action: "keep",
    name: "Slashing Legends Tin (Zacian)",
    type: "tin",
    set_names: [],
  },
  94882727: {
    action: "keep",
    name: "Mega Kangaskhan ex Box",
    type: "collection_box",
    set_names: ["Mega Evolution"],
  },
  94882721: {
    action: "keep",
    name: "Mega Venusaur ex Premium Collection",
    type: "premium_collection",
    set_names: ["Mega Evolution"],
  },
  94636866: {
    action: "keep",
    name: "Unova Victini Illustration Collection",
    type: "collection_box",
    set_names: ["Unova"],
  },
  94636854: {
    action: "keep",
    name: "Unova Poster Collection",
    type: "collection_box",
    set_names: ["Unova"],
  },
  95082138: {
    action: "keep",
    name: "Pokemon Day 2026 Collection",
    type: "collection_box",
    set_names: [],
  },
  94681785: {
    action: "keep",
    name: "White Flare Booster Bundle",
    type: "booster_bundle",
    set_names: ["White Flare"],
  },
  94681770: {
    action: "keep",
    name: "Black Bolt Booster Bundle",
    type: "booster_bundle",
    set_names: ["Black Bolt"],
  },
  94636862: {
    action: "keep",
    name: "Black Bolt Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["Black Bolt"],
  },
  94636860: {
    action: "keep",
    name: "White Flare Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["White Flare"],
  },
  94636856: {
    action: "keep",
    name: "Black Bolt Binder Collection",
    type: "collection_box",
    set_names: ["Black Bolt"],
  },
  94636851: {
    action: "keep",
    name: "White Flare Binder Collection",
    type: "collection_box",
    set_names: ["White Flare"],
  },
  94681780: {
    action: "keep",
    name: "White Flare Tech Sticker Collection",
    type: "collection_box",
    set_names: ["White Flare"],
  },
  94681767: {
    action: "keep",
    name: "Black Bolt Tech Sticker Collection",
    type: "collection_box",
    set_names: ["Black Bolt"],
  },
  88897904: {
    action: "keep",
    name: "151 Booster Bundle",
    type: "booster_bundle",
    set_names: ["151"],
  },
  88897899: {
    action: "keep",
    name: "151 Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["151"],
  },
  88897906: {
    action: "keep",
    name: "151 Ultra-Premium Collection",
    type: "premium_collection",
    set_names: ["151"],
  },
  93954435: {
    action: "keep",
    name: "Prismatic Evolutions Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["Prismatic Evolutions"],
  },
  93803457: {
    action: "keep",
    name: "Prismatic Evolutions Poster Collection",
    type: "collection_box",
    set_names: ["Prismatic Evolutions"],
  },
  93803439: {
    action: "keep",
    name: "Journey Together Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["Journey Together"],
  },
  94300074: {
    action: "keep",
    name: "Journey Together Booster Bundle",
    type: "booster_bundle",
    set_names: ["Journey Together"],
  },
  93859727: {
    action: "keep",
    name: "Journey Together Three-Booster Blister (Yanmega)",
    type: "three_pack_blister",
    set_names: ["Journey Together"],
  },
  93859728: {
    action: "keep",
    name: "Journey Together Three-Booster Blister (Scrafty)",
    type: "three_pack_blister",
    set_names: ["Journey Together"],
  },
  93486336: {
    action: "keep",
    name: "Surging Sparks Booster Pack",
    type: "booster_pack",
    set_names: ["Surging Sparks"],
  },
  94681703: {
    action: "keep",
    name: "Crown Zenith Premium Treasures Morpeko V-Union Box",
    type: "collection_box",
    set_names: ["Crown Zenith"],
  },
  89952654: {
    action: "keep",
    name: "Paldea Adventure Chest",
    type: "collection_box",
    set_names: [],
  },
  87266074: {
    action: "keep",
    name: "Trick or Trade BOOster Bundle",
    type: "special_box",
    set_names: [],
  },
  94636863: {
    action: "keep",
    name: "Holiday Calendar 2025",
    type: "collection_box",
    set_names: [],
  },
  1011960739: {
    action: "keep",
    name: "Perfect Order First Partner Illustration Collection",
    type: "collection_box",
    set_names: ["Perfect Order"],
  },
  94681760: {
    action: "keep",
    name: "Destined Rivals Booster Box",
    type: "booster_box",
    set_names: ["Destined Rivals"],
  },
  94583140: {
    action: "keep",
    name: "Journey Together Booster Box",
    type: "booster_box",
    set_names: ["Journey Together"],
  },
  93505293: {
    action: "keep",
    name: "Evolving Skies Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["Evolving Skies"],
  },
  1001561897: {
    action: "keep",
    name: "Blastoise VMAX Battle Box",
    type: "collection_box",
    set_names: [],
  },
  94882718: {
    action: "keep",
    name: "Collector Chest (Fall 2025)",
    type: "tin",
    set_names: [],
  },
  95230445: {
    action: "keep",
    name: "Perfect Order Elite Trainer Box",
    type: "elite_trainer_box",
    set_names: ["Perfect Order"],
  },
  95230447: {
    action: "keep",
    name: "Perfect Order Booster Bundle",
    type: "booster_bundle",
    set_names: ["Perfect Order"],
  },
  95252674: {
    action: "keep",
    name: "Perfect Order Booster Box",
    type: "booster_box",
    set_names: ["Perfect Order"],
  },
  1011389199: { action: "exclude", reason: "reseller mashup listing" },
  1011336297: { action: "exclude", reason: "reseller mashup listing" },
  1011261989: { action: "exclude", reason: "reseller mashup listing" },
  1011263094: { action: "exclude", reason: "reseller mashup listing" },
  1005215590: { action: "exclude", reason: "import / non-English product" },
  1003618047: { action: "exclude", reason: "book / media" },
  1011278178: { action: "exclude", reason: "reseller mashup listing" },
  95000353: {
    action: "keep",
    name: "Mega Lucario ex Figure Collection",
    type: "premium_collection",
    set_names: ["Mega Evolution"],
  },
  85404736: {
    action: "keep",
    name: "Spring 2022 Collector Chest",
    type: "tin",
    set_names: [],
  },
  1004842211: {
    action: "keep",
    name: "White Flare Booster Pack",
    type: "booster_pack",
    set_names: ["White Flare"],
  },
};

const AMBIGUOUS = [];

function bestText(row) {
  const candidates = [row.title, ...(row.alts ?? [])].filter(Boolean);
  const scored = candidates.map((t) => {
    let score = t.length;
    if (/pokemon trading card game|pokémon trading card game|pokémon tcg|pokemon tcg/i.test(t)) score += 50;
    if (/trading cards$/i.test(t) && t.length < 60) score -= 30;
    if (/^\d{4}\s+(pok|pokémon|pokemon)\s/i.test(t)) score -= 20;
    if (/collectible trading cards$/i.test(t)) score -= 40;
    if (t.length < 15) score -= 30;
    if (/^3 pack blister:?$/i.test(t)) score -= 100;
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.t ?? row.title;
}

function normalizeText(text) {
  return text
    .replace(/\u2014/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

const MEGA_SUBSETS = ["Perfect Order", "Chaos Rising", "Pitch Black", "Ascended Heroes", "Phantasmal Flames"];

function extractSets(text) {
  const found = [];
  for (const [pattern, name] of SET_PATTERNS) {
    if (pattern.test(text) && !found.includes(name)) found.push(name);
  }
  // S10.5 without explicit name: infer from V1/V2/Box 1/Box 2 context in alts handled by overrides
  if (/\bS10\.5\b/i.test(text) && found.length === 0) {
    if (/v1|box 2|binder 2|etb 1|white/i.test(text)) found.push("White Flare");
    else if (/box 1|binder 1|etb 2|black/i.test(text)) found.push("Black Bolt");
  }
  if (/\bS8\.5\b/i.test(text) && !found.includes("Prismatic Evolutions")) found.push("Prismatic Evolutions");
  if (/\bS9\b/i.test(text) && !found.some((s) => s !== "Scarlet & Violet")) found.push("Journey Together");
  if (/\bS3\.5\b/i.test(text) && !found.includes("151")) found.push("151");
  if (/\bME2\.5\b|\bS2\.5\b/i.test(text) && !found.includes("Ascended Heroes")) found.push("Ascended Heroes");
  if (/\bME2\b/i.test(text) && !found.includes("Phantasmal Flames")) found.push("Phantasmal Flames");
  if (/\bME1\b/i.test(text) && !found.includes("Mega Evolution")) found.push("Mega Evolution");
  if (/\bSV10\.5\b/i.test(text)) {
    if (/white/i.test(text) && !found.includes("White Flare")) found.push("White Flare");
    if (/black/i.test(text) && !found.includes("Black Bolt")) found.push("Black Bolt");
  } else if (/\bSV10\b/i.test(text) && !found.includes("Destined Rivals")) {
    found.push("Destined Rivals");
  }
  if (/\bSV8\.5\b/i.test(text) && !found.includes("Prismatic Evolutions")) found.push("Prismatic Evolutions");
  return refineSets(found);
}

function refineSets(found) {
  let sets = [...found];
  if (sets.some((s) => MEGA_SUBSETS.includes(s))) {
    sets = sets.filter((s) => s !== "Mega Evolution");
  }
  const specificSv = sets.filter((s) => s !== "Scarlet & Violet" && s !== "Mega Evolution");
  if (specificSv.length > 0) {
    sets = sets.filter((s) => s !== "Scarlet & Violet");
  }
  return sets;
}

function cleanName(text) {
  let name = normalizeText(text);
  name = name
    .replace(/^pokemon trading card game\s*[:—-]\s*/i, "")
    .replace(/^pokémon trading card game\s*[:—-]\s*/i, "")
    .replace(/^pokemon tcg\s*[:—-]\s*/i, "")
    .replace(/^pokémon tcg\s*[:—-]\s*/i, "")
    .replace(/^pokemon\s+/i, "")
    .replace(/^pokémon\s+/i, "")
    .replace(/^pok\s+/i, "")
    .replace(/^\d{4}\s+(pok|pokémon|pokemon)\s+/i, "")
    .replace(/\s+trading cards$/i, "")
    .replace(/\s+collectible trading cards$/i, "")
    .replace(/\s+v\d+$/i, "")
    .replace(/\s+version\s+\d+$/i, "")
    .replace(/\s+box\s+trading cards$/i, "")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+!\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  name = name
    .replace(/^mega evolution\s+s\d+(?:\.\d+)?\s+/i, "")
    .replace(/^mega evolution[—-]\s*/i, "")
    .replace(/^scarlet\s*&?\s*violet\s*[—-]\s*/i, "")
    .replace(/^scarlet\s*&?\s*violet\s*-\s*/i, "")
    .replace(/^mega evolution\s+/i, "")
    .replace(/^scarlet violet\s+s[\d.]+\s+/i, "")
    .replace(/^dec prem\s+/i, "Mega ")
    .replace(/^collector chest fall tin$/i, "Collector Chest (Fall 2025)")
    .replace(/\s+blaster$/i, "")
    .trim();
  return name;
}

function classifyType(text) {
  const t = text.toLowerCase();
  if (/premium\s*check\s*-?\s*lane|checklane/i.test(t) && /premium/i.test(t)) return "premium_checklane_blister";
  if (/check\s*-?\s*lane/i.test(t)) return "checklane_blister";
  if (/(3|three)\s*-?\s*(pk|pack)\s*(blister|blaster)|three[\s-]*booster\s*blister/i.test(t)) return "three_pack_blister";
  if (/(1|single|one)\s*-?\s*pack\s*blister/i.test(t)) return "single_pack_blister";
  if (/sleeved\s*booster/i.test(t)) return "sleeved_booster_pack";
  if (/build\s*(&|and|\+)?\s*battle/i.test(t)) return "build_battle_box";
  if (/elite\s*trainer\s*box|\betb\b/i.test(t)) return "elite_trainer_box";
  if (/booster\s*bundle/i.test(t)) return "booster_bundle";
  if (/booster\s*(box|display)|display\s*box/i.test(t)) return "booster_box";
  if (/(ultra|super)\s*-?\s*premium|premium\s*(figure|poster)\s*collection|\bfigure\s*collection\b/i.test(t)) return "premium_collection";
  if (/premium\s*collection/i.test(t)) return "premium_collection";
  if (/surprise\s*box|fun\s*pack|accessory\s*pouch|trick\s*or\s*trade/i.test(t)) return "special_box";
  if (/collector\s*chest/i.test(t)) return "tin";
  if (
    /collection|tech\s*sticker|binder\s*collection|poster\s*collection|pin\s*collection|illustration\s*collection|grand\s*adventure|ex\s*box|special\s*collection|holiday\s*calendar|adventure\s*chest|collector\s*chest|v[\s-]*union|premium\s*treasures|first\s*partner/i.test(t)
  ) return "collection_box";
  if (/\btins?\b|stacking\s*tin|collector\s*chest/i.test(t)) return "tin";
  if (/\bbooster\s*pack\b/i.test(t) && !/bundle|box|display|lot/i.test(t)) return "booster_pack";
  return null;
}

const EXCLUDE_PATTERNS = [
  { pattern: /pokemon\s*center/i, reason: "Pokemon Center exclusive" },
  { pattern: /one\s*piece\s*card\s*game/i, reason: "not a Pokemon TCG product" },
  { pattern: /lorcana/i, reason: "not a Pokemon TCG product" },
  { pattern: /yu[\s-]?gi[\s-]?oh/i, reason: "not a Pokemon TCG product" },
  { pattern: /magic:\s*the\s*gathering|avatar:\s*the\s*last\s*airbender/i, reason: "not a Pokemon TCG product" },
  { pattern: /panini\s+nfl|weiss\s+schwarz/i, reason: "not a Pokemon TCG product" },
  { pattern: /nintendo\s+switch/i, reason: "video game / console" },
  { pattern: /\blego\b/i, reason: "not a TCG product" },
  { pattern: /funko\s*pop/i, reason: "not a TCG product" },
  { pattern: /plush/i, reason: "not a TCG product" },
  { pattern: /waffle\s*maker|sandwich\s*maker/i, reason: "not a TCG product" },
  { pattern: /pajama|t-shirt|graphic\s*print.*shirt|reversible\s*jersey/i, reason: "apparel" },
  { pattern: /paperback|hardcover|mixed\s*media/i, reason: "book / media" },
  { pattern: /viz\s*media/i, reason: "video media" },
  { pattern: /spaghettios|canned\s*pasta/i, reason: "not a TCG product" },
  { pattern: /coloring\s*set/i, reason: "not a TCG product" },
  { pattern: /framed\s*poster(?!\s*collection)/i, reason: "not a TCG product" },
  { pattern: /bronzer|concealer|blender\s*metallic|toaster\s*oven|ninja\s+(blast|flip|foodi)/i, reason: "not a Pokemon product" },
  { pattern: /goodnites|wwe\s+main\s+event|picasso-tiles|best\s*blocks|rubies\s+united|poker\s*set|mometrix|maybelline|journey\s+together\s+publishing/i, reason: "not a Pokemon product" },
  { pattern: /powera.*controller/i, reason: "not a TCG product" },
  { pattern: /takara\s*tomy|moncolle|mega\s*construx/i, reason: "figure / toy" },
  { pattern: /battle\s*fig\b|action\s*figure/i, reason: "figure / toy" },
  { pattern: /trapper\s*keeper/i, reason: "school supply, not TCG" },
  { pattern: /deck\s*shield|65ct/i, reason: "card accessory only" },
  { pattern: /9[\s-]*pocket\s*(ultra\s*pro\s*)?portfolio|mini\s*portfolio|\bportfolio\b/i, reason: "card accessory only" },
  { pattern: /ultra[\s-]?pro.*portfolio/i, reason: "card accessory only" },
  { pattern: /meddling\s*sparks/i, reason: "monitor noise (unrecognized product)" },
  { pattern: /poke\s*ball\s+alolan\s+meowth/i, reason: "not a TCG product" },
  { pattern: /libro\s+oficial|gu[ií]a\s+definitiva|aventuras\s+en\s+la\s+regi|gigantamax\s*clash/i, reason: "book / media" },
  { pattern: /deck\s*build\s*box/i, reason: "import / non-English product" },
  { pattern: /salt\s*and\s*pepper/i, reason: "not a TCG product" },
  { pattern: /untitled\s*-/i, reason: "monitor noise" },
  { pattern: /walking\s+together\s+in\s+the\s+freedom/i, reason: "not a Pokemon product" },
  { pattern: /rise\s*girl,?\s*rise/i, reason: "not a Pokemon product" },
  { pattern: /pok\s*pok\s+noodles/i, reason: "not a Pokemon product" },
  { pattern: /island\s*poke\s*cookbook/i, reason: "not a Pokemon product" },
  { pattern: /half\s*booster\s*box/i, reason: "half booster box" },
  { pattern: /\bcase\s+of\s+\d+/i, reason: "case variant" },
  { pattern: /\d+[\s-]*case\b/i, reason: "case variant" },
  { pattern: /display\s*case/i, reason: "case variant" },
  { pattern: /mini\s*tin\s*display|\btin\s*display\b|\bdisplay\s*\(\d+\s*(ct|units?)/i, reason: "case/display variant" },
  { pattern: /\(\d+[\s-]*pack\)|\(\d+\s*-?\s*pack\s*bundle\)|\d+[\s-]*pack\s*(lot|bundle)|booster\s*pack\s*lot|sleeved\s*booster\s*pack\s*lot/i, reason: "multi-pack lot / bundle" },
  { pattern: /\(\d+-pack\)|\(\d+\s*units?\s*-|\bone\s+of\s+each\b/i, reason: "multi-pack lot / bundle" },
  { pattern: /art\s*bundle/i, reason: "multi-pack lot / bundle" },
  { pattern: /\b2-pack\b|\b3-pack\b|\b4-pack\b|\b5-pack\b|\(2-pack\)|\(3-pack\)|\(2\s*pack\)/i, reason: "multi-pack lot / bundle" },
  { pattern: /\d+\s*pack\s*bundle|\d+\s*piecc?es\b/i, reason: "multi-pack lot / bundle" },
  { pattern: /world\s*championships?\s*deck/i, reason: "pre-built deck" },
  { pattern: /battle\s*deck|deluxe\s*battle\s*deck|kkaku\s*battle/i, reason: "pre-built deck" },
  { pattern: /mystery\s*booster/i, reason: "third-party repack" },
  { pattern: /\bchinese\b|\bsimplified\s*chinese\b|\bjapanese\s*version\b/i, reason: "import / non-English product" },
  { pattern: /gem\s*pack\s*vol/i, reason: "import / non-English product" },
  { pattern: /10\s*card\s*pack/i, reason: "single cards / small pack" },
  { pattern: /graded|psa\s*\d|bgs\s*\d|slab/i, reason: "graded card" },
  { pattern: /showcase$/i, reason: "display product, not sealed retail SKU" },
  { pattern: /^3\s*pack\s*blister:?\s*$/i, reason: "monitor noise (truncated title)" },
  { pattern: /^untitled$/i, reason: "monitor noise" },
  { pattern: /tournament\s*collection/i, reason: "pre-built deck product" },
  { pattern: /mabosstiff\s*ex\s*showcase/i, reason: "display product" },
];

function shouldExclude(row, text) {
  const override = SKU_OVERRIDES[row.sku];
  if (override?.action === "exclude") return override.reason;
  if (override?.action === "keep") return null;

  const haystack = [text, row.title, ...(row.alts ?? [])].join(" | ");

  for (const { pattern, reason } of EXCLUDE_PATTERNS) {
    if (pattern.test(haystack)) return reason;
  }

  // Single booster pack detection (keep) vs lot
  if (/\bbooster\s*pack\b/i.test(text) && /\|\s*\w+/i.test(text) && !/blister|collection|bundle|box/i.test(text)) {
    // individual art variant booster pack — keep handled by classify
  }

  // Reseller mashup titles
  if (
    /prismatic.*perfect\s*order|perfect\s*order.*prismatic|mega evolution.*prismatic.*evolutions.*(?:etb|blister|booster)|prismatic.*mega evolution.*perfect|ah-violet|po-etb|po[\s-]booster|2-booster\s*-/i.test(
      haystack,
    )
  ) {
    return "reseller mashup listing";
  }

  if (text.length < 12 && !/tin|etb/i.test(text)) return "monitor noise (truncated title)";
  if (/^2025\s+pok(é|e)?mon\s+\w+\s+v\d+\s+collectible/i.test(row.title) && !(row.alts?.length)) {
    return "monitor noise (generic Target title)";
  }
  if (/^2025\s+pokemon\s+scarlet\s+violet\s+q\d/i.test(row.title) && /stacking/i.test(haystack)) {
    // stacking tin with generic title — keep
    return null;
  }
  if (/^2025\s+pokemon\s+scarlet\s+violet\s+q\d/i.test(row.title) && !/stacking/i.test(haystack)) {
    return "monitor noise (generic Target title)";
  }
  if (/^2025\s+pokémon\s+summer/i.test(row.title)) return "monitor noise (generic Target title)";

  return null;
}

const MSRP_DEFAULTS = {
  booster_pack: 449,
  sleeved_booster_pack: 459,
  single_pack_blister: 599,
  checklane_blister: 499,
  premium_checklane_blister: 1299,
  three_pack_blister: 1499,
  tin: 2499,
  collection_box: 2499,
  build_battle_box: 2199,
  booster_bundle: 2699,
  special_box: 2299,
  elite_trainer_box: 4999,
  premium_collection: 4999,
  booster_box: 14399,
};

function estimateMsrp(type, prices) {
  const sorted = [...(prices ?? [])].sort((a, b) => a - b);
  const typical = MSRP_DEFAULTS[type] ?? null;

  if (sorted.length === 0) {
    return { msrp_cents: typical, msrp_confidence: typical ? "inferred" : "unknown" };
  }

  const low = sorted[0];
  if (typical) {
    // If lowest observed is within ~40% of typical MSRP, treat as observed
    if (low >= typical * 0.75 && low <= typical * 1.15) {
      return { msrp_cents: low, msrp_confidence: "observed" };
    }
    // Sale price still plausible
    if (low >= typical * 0.5 && low < typical * 0.75) {
      return { msrp_cents: typical, msrp_confidence: "inferred" };
    }
    // Markup/resale above MSRP
    if (low > typical * 1.15 && sorted.some((p) => p >= typical * 0.75 && p <= typical * 1.15)) {
      const near = sorted.find((p) => p >= typical * 0.75 && p <= typical * 1.15);
      return { msrp_cents: near, msrp_confidence: "observed" };
    }
    if (low > typical * 1.5) {
      return { msrp_cents: typical, msrp_confidence: "inferred" };
    }
    return { msrp_cents: low, msrp_confidence: "observed" };
  }

  return { msrp_cents: low, msrp_confidence: "observed" };
}

function variableSetProduct(type, text) {
  const t = text.toLowerCase();
  if (/stacking\s*tin|team\s*rocket\s*tin|heroes\s*tin|paradox\s*clash\s*tin|paldea\s*partners\s*tin|collector\s*chest|holiday\s*calendar|pokemon\s*day|trick\s*or\s*trade|lumiose\s*city/i.test(t)) return true;
  if (type === "tin" && !extractSets(text).length) return true;
  return false;
}

function processRow(row) {
  const text = bestText(row);
  const override = SKU_OVERRIDES[row.sku];

  if (override?.action === "exclude") {
    return { excluded: { sku: row.sku, title: row.title, reason: override.reason } };
  }

  const excludeReason = shouldExclude(row, text);
  if (excludeReason) {
    return { excluded: { sku: row.sku, title: row.title, reason: excludeReason } };
  }

  const type = override?.type ?? classifyType(text);
  if (!type) {
    // Last-chance: ex box pattern
    if (/\bex\s*box\b/i.test(text) || /\bex\s*&/i.test(text)) {
      // keep as collection_box
    } else if (/v\s*box\b/i.test(text)) {
      // V Box products
    } else {
      AMBIGUOUS.push({ sku: row.sku, title: row.title, alts: row.alts });
      return { excluded: { sku: row.sku, title: row.title, reason: "could not classify product type" } };
    }
  }

  const finalType = override?.type ?? type ?? (/\bv\s*box\b/i.test(text) || /\bex\s*box\b/i.test(text) ? "collection_box" : null);
  if (!finalType) {
    return { excluded: { sku: row.sku, title: row.title, reason: "could not classify product type" } };
  }

  let set_names = override?.set_names ?? extractSets(text);
  if (!override?.set_names && variableSetProduct(finalType, text)) {
    set_names = [];
  }

  const name = override?.name ?? cleanName(text);
  const { msrp_cents, msrp_confidence } = estimateMsrp(finalType, row.prices);

  const keeper = {
    sku: row.sku,
    name,
    type: finalType,
    set_names,
    msrp_cents,
    msrp_confidence,
    hits: row.hits,
    first_seen: row.first_seen,
  };

  // Premium collections with inflated observed prices
  if (finalType === "premium_collection" && /ultra[\s-]*premium/i.test(text)) {
    keeper.msrp_cents = keeper.msrp_cents && keeper.msrp_cents < 8000 ? 12999 : keeper.msrp_cents ?? 12999;
    if (keeper.msrp_confidence === "observed" && keeper.msrp_cents >= 10000) keeper.msrp_confidence = "observed";
    else if (!row.prices?.some((p) => p >= 10000 && p <= 14000)) keeper.msrp_confidence = "inferred";
  }
  if (finalType === "premium_collection" && /super[\s-]*premium/i.test(text)) {
    if (!keeper.msrp_cents || keeper.msrp_cents < 7000) {
      keeper.msrp_cents = row.prices?.find((p) => p >= 8000 && p <= 12000) ?? 8999;
      keeper.msrp_confidence = row.prices?.some((p) => p >= 8000 && p <= 12000) ? "observed" : "inferred";
    }
  }
  if (finalType === "booster_box" && keeper.msrp_cents && keeper.msrp_cents < 10000) {
    keeper.msrp_cents = 17999;
    keeper.msrp_confidence = "inferred";
  }

  return { kept: keeper };
}

// --- main ---
const rows = readFileSync(INPUT, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

const kept = [];
const excluded = [];

for (const row of rows) {
  const result = processRow(row);
  if (result.kept) kept.push(result.kept);
  else excluded.push(result.excluded);
}

kept.sort((a, b) => b.hits - a.hits);

const total = kept.length + excluded.length;
if (total !== rows.length) {
  console.error(`Count mismatch: ${kept.length} kept + ${excluded.length} excluded = ${total}, expected ${rows.length}`);
  process.exit(1);
}

const skuSet = new Set();
for (const k of kept) {
  if (skuSet.has(k.sku)) console.error("Duplicate kept sku", k.sku);
  skuSet.add(k.sku);
}
for (const e of excluded) {
  if (skuSet.has(e.sku)) console.error("Duplicate excluded sku", e.sku);
  skuSet.add(e.sku);
}
if (skuSet.size !== rows.length) {
  console.error("SKU coverage mismatch");
  process.exit(1);
}

writeFileSync(OUTPUT, JSON.stringify({ kept, excluded }, null, 2) + "\n");

// Summary stats
const reasonCounts = {};
for (const e of excluded) reasonCounts[e.reason] = (reasonCounts[e.reason] ?? 0) + 1;

const typeCounts = {};
for (const k of kept) typeCounts[k.type] = (typeCounts[k.type] ?? 0) + 1;

const multiSet = kept.filter((k) => k.set_names.length > 1).length;
const unknownMsrp = kept.filter((k) => k.msrp_confidence === "unknown").length;

console.log(JSON.stringify({
  kept: kept.length,
  excluded: excluded.length,
  total,
  reasonCounts,
  typeCounts,
  multiSet,
  unknownMsrp,
  ambiguous: AMBIGUOUS,
}, null, 2));
