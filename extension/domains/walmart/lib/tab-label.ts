import {
  checkoutStepFromPath,
  classifyWalmartPageKind,
} from "@ext/domains/walmart/lib/page-kind.ts";
import type { WalmartPageKind } from "@ext/domains/walmart/types/walmart.ts";

const LABEL_MAX_LEN = 48;

const WALMART_TITLE_SUFFIXES = [
  " - Walmart.com",
  " | Walmart.com",
  " - Walmart",
] as const;

const CHECKOUT_STEP_LABELS: Record<string, string> = {
  "review-order": "Review",
  shipping: "Shipping",
  payment: "Payment",
  "place-order": "Place order",
};

export function truncateLabel(text: string, maxLen = LABEL_MAX_LEN): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export function cleanWalmartProductTitle(title: string): string {
  let cleaned = title.trim();
  for (const suffix of WALMART_TITLE_SUFFIXES) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trim();
    }
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

function productSlugFromUrl(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/ip\/([^/]+)/);
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
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments.at(-1);
    if (!last) {
      return "Walmart";
    }
    return humanizeSlug(last);
  } catch {
    return "Walmart";
  }
}

function labelForKind(kind: WalmartPageKind, url: string, title: string): string {
  switch (kind) {
    case "home":
      return "Home";
    case "cart":
      return "Cart";
    case "post_checkout":
      return "Order confirmed";
    case "search":
      return "Search";
    case "queue":
      return "Queue";
    case "pac":
      return "PAC";
    case "blocked":
      return "Blocked";
    case "checkout": {
      const step = checkoutStepFromPath(url);
      const stepLabel = step ? CHECKOUT_STEP_LABELS[step] : undefined;
      return stepLabel ? `Checkout · ${stepLabel}` : "Checkout";
    }
    case "product": {
      const cleaned = cleanWalmartProductTitle(title);
      if (cleaned) {
        return truncateLabel(cleaned);
      }
      return truncateLabel(productSlugFromUrl(url) ?? "Product");
    }
    case "other":
      return truncateLabel(lastPathSegmentLabel(url));
    default:
      return "Walmart";
  }
}

function productItemIdFromUrl(url: string): string | undefined {
  try {
    const match = new URL(url).pathname.match(/\/ip\/[^/]+\/(\d+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function withLabelSuffix(base: string, suffix: string): string {
  const maxBaseLen = LABEL_MAX_LEN - suffix.length;
  if (base.length <= maxBaseLen) {
    return `${base}${suffix}`;
  }
  return `${base.slice(0, maxBaseLen - 1)}…${suffix}`;
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

    const itemId = productItemIdFromUrl(tab.url);
    if (itemId) {
      const peersWithSameItem = tabs.filter(
        (peer) => peer.label === tab.label && productItemIdFromUrl(peer.url) === itemId,
      );
      if (peersWithSameItem.length === 1) {
        return withLabelSuffix(tab.label, ` #${itemId}`);
      }
    }

    return withLabelSuffix(tab.label, ` · T${tab.tabId}`);
  });
}

export function labelWalmartTab(
  url: string,
  title?: string,
): { label: string; pageKind: WalmartPageKind } {
  const pageKind = classifyWalmartPageKind(url);
  const label = labelForKind(pageKind, url, title ?? "");
  return { label, pageKind };
}
