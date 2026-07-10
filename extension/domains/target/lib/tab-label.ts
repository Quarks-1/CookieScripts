import { unwrapAffiliateUrl } from "@ext/core/lib/affiliate-unwrap.ts";
import {
  isOrderConfirmationUrl,
  isRetailerCheckoutUrl,
} from "@ext/domains/target/lib/checkout/checkout-url.ts";
import { isRetailerProductUrl } from "@ext/domains/target/lib/host.ts";
import type { RetailerPageKind } from "@ext/domains/target/types/retailer.ts";

const LABEL_MAX_LEN = 48;

const TARGET_TITLE_SUFFIXES = [" : Target", " | Target", " - Target"] as const;

const PRODUCT_TITLE_PREFIXES = [
  /^Pokémon Trading Card Game:\s*/i,
  /^Pokemon Trading Card Game:\s*/i,
] as const;

export function truncateLabel(text: string, maxLen = LABEL_MAX_LEN): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export function cleanRetailerProductTitle(title: string): string {
  let cleaned = title.trim();
  for (const suffix of TARGET_TITLE_SUFFIXES) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trim();
    }
  }
  for (const prefix of PRODUCT_TITLE_PREFIXES) {
    cleaned = cleaned.replace(prefix, "").trim();
  }
  return cleaned;
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function pathnameFromUrl(url: string): string {
  try {
    return new URL(unwrapAffiliateUrl(url)).pathname;
  } catch {
    return "";
  }
}

function isHomePath(path: string): boolean {
  return path === "/" || path === "";
}

function isCartPath(path: string): boolean {
  return path === "/cart" || path.startsWith("/cart/");
}

function productSlugFromUrl(url: string): string | undefined {
  try {
    const path = new URL(unwrapAffiliateUrl(url)).pathname;
    const match = path.match(/\/p\/([^/]+)/);
    if (!match?.[1]) {
      return undefined;
    }
    return humanizeSlug(match[1]);
  } catch {
    return undefined;
  }
}

function lastPathSegmentLabel(url: string): string {
  try {
    const segments = new URL(unwrapAffiliateUrl(url)).pathname.split("/").filter(Boolean);
    const last = segments.at(-1);
    if (!last) {
      return "Target";
    }
    return humanizeSlug(last);
  } catch {
    return "Target";
  }
}

export function classifyRetailerPageKind(url: string): RetailerPageKind {
  if (isOrderConfirmationUrl(url)) {
    return "order_confirmation";
  }
  if (isRetailerCheckoutUrl(url)) {
    return "checkout";
  }
  const path = pathnameFromUrl(url);
  if (isCartPath(path)) {
    return "cart";
  }
  if (isRetailerProductUrl(url)) {
    return "product";
  }
  if (isHomePath(path)) {
    return "home";
  }
  return "other";
}

function labelForKind(kind: RetailerPageKind, url: string, title: string): string {
  switch (kind) {
    case "home":
      return "Home";
    case "cart":
      return "Cart";
    case "checkout":
      return "Checkout";
    case "order_confirmation":
      return "Order confirmed";
    case "product": {
      const cleaned = cleanRetailerProductTitle(title);
      if (cleaned) {
        return cleaned;
      }
      return productSlugFromUrl(url) ?? "Product";
    }
    case "other":
      return truncateLabel(lastPathSegmentLabel(url));
    default:
      return "Target";
  }
}

function tcinFromUrl(url: string): string | undefined {
  try {
    const match = new URL(unwrapAffiliateUrl(url)).pathname.match(/\/A-(\d+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function withLabelSuffix(base: string, suffix: string): string {
  return `${base}${suffix}`;
}

export function disambiguateOpenTabLabels(
  tabs: ReadonlyArray<{ label: string; url: string; tabId: number }>,
): string[] {
  const labelCounts = new Map<string, number>();
  for (const tab of tabs) {
    labelCounts.set(tab.label, (labelCounts.get(tab.label) ?? 0) + 1);
  }

  return tabs.map((tab) => {
    if ((labelCounts.get(tab.label) ?? 0) <= 1) {
      return tab.label;
    }

    const tcin = tcinFromUrl(tab.url);
    if (tcin) {
      const peersWithSameTcin = tabs.filter(
        (peer) => peer.label === tab.label && tcinFromUrl(peer.url) === tcin,
      );
      if (peersWithSameTcin.length === 1) {
        return withLabelSuffix(tab.label, ` · T${tcin}`);
      }
    }

    return withLabelSuffix(tab.label, ` · T${tab.tabId}`);
  });
}

export function labelRetailerTab(
  url: string,
  title?: string,
): { label: string; pageKind: RetailerPageKind } {
  const pageKind = classifyRetailerPageKind(url);
  const label = labelForKind(pageKind, url, title ?? "");
  return { label, pageKind };
}
