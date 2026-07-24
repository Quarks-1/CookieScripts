// Throwaway: shared product-name cleanup, used by both reconcile and the
// standalone verification pass. Deliberately conservative — it only strips
// patterns that are provably noise (set codes, era prefixes, leading
// punctuation, casing), never distinguishing detail like character or series
// names.

// Era/block prefixes that add nothing when a specific set is already named.
const ERAS = ["Scarlet & Violet", "Scarlet and Violet", "Sword & Shield", "Sword and Shield"];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function makeNormalizer(setNames) {
  return function normalize(raw) {
    let n = raw;

    n = n.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    n = n.replace(/[\u2013\u2014]/g, "-");
    n = n.replace(/\u00a0/g, " ");

    // Leading vendor/category noise.
    n = n.replace(/^\s*Pok[eé]mon\s+Trading\s+Card\s+Game\s*:?\s*/i, "");
    n = n.replace(/^\s*Pok[eé]mon\s+TCG\s*:?\s*/i, "");
    n = n.replace(/^\s*TCG\s*:?\s*/i, "");
    // Deliberately no bare "Pokemon " strip: it eats real names like "Pokemon Day 2026".

    // Internal set codes: ME2, SV8.5, SWSH12, S10.5 — only when followed by a word.
    n = n.replace(/\b(?:ME|SV|SWSH|S)\d+(?:\.\d+)?\b\s*[-:]?\s*(?=\S)/gi, "");

    // Era prefix directly before a real set name.
    for (const era of ERAS) {
      for (const set of setNames) {
        n = n.replace(new RegExp(`\\b${escape(era)}\\s+(?=${escape(set)}\\b)`, "gi"), "");
      }
    }
    // Era left dangling at the very start with no set following.
    for (const era of ERAS) {
      n = n.replace(new RegExp(`^\\s*${escape(era)}\\s*[-:]?\\s+(?=\\S)`, "i"), "");
    }

    // Leading/trailing separators and stray punctuation.
    n = n.replace(/^[\s\-–—:,|]+/, "").replace(/[\s\-–—:,|]+$/, "");
    // Collapse runs of separators left behind by removals.
    n = n.replace(/\s*-\s*-\s*/g, " - ");
    n = n.replace(/\s{2,}/g, " ");

    // Pokemon styles the SV-era suffix lowercase.
    n = n.replace(/\b(?:EX|Ex)\b/g, "ex");
    n = n.replace(/\bVMAX\b/gi, "VMAX").replace(/\bV-?UNION\b/gi, "V-UNION");

    // Duplicated set name ("Ascended Heroes Ascended Heroes ETB").
    for (const set of setNames) {
      n = n.replace(new RegExp(`\\b(${escape(set)})\\s+\\1\\b`, "gi"), "$1");
    }

    return n.trim();
  };
}
