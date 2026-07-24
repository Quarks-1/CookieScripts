export const STOP_WORDS = new Set([
  "pokemon",
  "tcg",
  "trading",
  "card",
  "game",
  "the",
  "and",
  "set",
  "pack",
  "packs",
  "box",
  "collection",
  "scarlet",
  "violet",
  "sword",
  "shield",
  "promo",
  "cards",
  "card",
]);

/**
 * @param {string} name
 * @returns {Set<string>}
 */
export function tokenize(name) {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t)),
  );
}

/**
 * Jaccard-style overlap on distinguishing words only.
 * @param {string} ourName
 * @param {string} seoUrl
 * @returns {number}
 */
export function slugSimilarity(ourName, seoUrl) {
  const a = tokenize(ourName);
  const b = tokenize(seoUrl.replace(/^\/ip\//, "").replace(/\/\d+$/, "").replace(/-/g, " "));
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / a.size;
}

/**
 * @param {Response} res
 * @returns {{ validHeader: string | null, seoUrl: string | null }}
 */
export function parseWalmartProbeResponse(res) {
  const validHeader = res.headers.get("x-usgm-validitemid");
  const seoUrl = res.headers.get("x-usgm-item-seo-url") ?? res.headers.get("location");
  return { validHeader, seoUrl };
}

/**
 * @param {{ validHeader: string | null, seoUrl: string | null, ourName: string }} params
 * @returns {{ status: string, identity_mismatch: boolean, similarity: number, walmart_slug: string | null }}
 */
export function classifyWalmartProbe({ validHeader, seoUrl, ourName }) {
  const status =
    validHeader === "true" ? "valid" : validHeader === "false" ? "invalid" : "unclear";
  const similarity = seoUrl ? slugSimilarity(ourName, seoUrl) : 0;
  const identity_mismatch = status === "valid" && similarity < 0.34;
  const walmart_slug = seoUrl
    ? seoUrl.replace(/^\/ip\//, "").replace(/\/\d+$/, "").replace(/-/g, " ")
    : null;
  return {
    status,
    identity_mismatch,
    similarity: Number(similarity.toFixed(2)),
    walmart_slug,
  };
}
