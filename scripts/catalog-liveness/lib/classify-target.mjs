/** Known-live first-party TCINs used as soft-block controls. */
export const TARGET_CONTROLS = ["95230445", "95230447", "94681785"];

/**
 * Classify Target PDP HTML as live, dead, marketplace, or unclear.
 * @param {string} html
 * @returns {{ status: string, title: string | null, marketplace: boolean, note?: string }}
 */
export function classifyTargetHtml(html) {
  const unavailable = /currently unavailable/i.test(html);
  const og =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const title = og ? og[1].trim() : null;
  const marketplace = /sold\s+(?:and\s+shipped\s+)?by|target\s*\+|targetplus/i.test(html);

  if (unavailable && !title) return { status: "dead", title: null, marketplace: false };
  if (!unavailable && title) {
    return { status: marketplace ? "live_marketplace" : "live", title, marketplace };
  }
  return {
    status: "unclear",
    title,
    marketplace,
    note: `unavailable=${unavailable} title=${Boolean(title)}`,
  };
}

/**
 * @param {Array<{ status: string }>} controlResults
 * @returns {boolean}
 */
export function isBlockedByControls(controlResults) {
  return controlResults.some((entry) => entry.status === "dead");
}
