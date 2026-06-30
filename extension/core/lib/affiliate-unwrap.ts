function normalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

function isHttpOrHttpsUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const DEEPLINK_QUERY_PARAMS = ["u", "url", "murl", "destination", "redirect"] as const;

/** Hosts that only wrap a retailer URL in a query param (Impact, CJ, Rakuten, etc.). */
const AFFILIATE_REDIRECT_HOST_SUFFIXES = [
  "linksynergy.com",
  "rakutenmarketing.com",
  "anrdoezrs.net",
  "dpbolvw.net",
  "kqzyfj.com",
  "tkqlhce.com",
  "cj.com",
  "cjlinks.com",
  "awin1.com",
  "awin.com",
  "pxf.io",
  "sjv.io",
  "impactradius.com",
] as const;

function getEncodedDestination(parsed: URL): string | null {
  for (const param of DEEPLINK_QUERY_PARAMS) {
    const raw = parsed.searchParams.get(param);
    if (!raw) {
      continue;
    }
    try {
      const decoded = decodeURIComponent(raw);
      if (isHttpOrHttpsUrl(decoded)) {
        return decoded;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function isAffiliateRedirectHost(host: string): boolean {
  if (host.startsWith("goto.") && host.endsWith(".com")) {
    return true;
  }
  return AFFILIATE_REDIRECT_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith("." + suffix),
  );
}

function unwrapOnce(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (!isAffiliateRedirectHost(normalizeHost(parsed.hostname))) {
    return url;
  }

  const inner = getEncodedDestination(parsed);
  return inner ?? url;
}

/** Follow nested affiliate wrappers (e.g. shortener → Impact → retailer). */
export function unwrapAffiliateUrl(url: string): string {
  let current = url;
  for (let depth = 0; depth < 3; depth++) {
    const next = unwrapOnce(current);
    if (next === current) {
      break;
    }
    current = next;
  }
  return current;
}
