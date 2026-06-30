import {
  checkoutStepFromPath,
  classifyWalmartPageKind,
} from "@ext/domains/walmart/lib/page-kind.ts";
import type { MarkerLabel } from "@ext/domains/walmart/types/walmart.ts";

export type AutoMarkerMatch = {
  label: MarkerLabel;
  detail?: string;
};

const KIND_TO_MARKER: Partial<Record<ReturnType<typeof classifyWalmartPageKind>, MarkerLabel>> = {
  blocked: "Blocked",
  queue: "Joined queue",
  search: "Search",
  product: "Product page",
  pac: "PAC",
  cart: "Cart page",
  post_checkout: "Post-checkout",
  checkout: "Pre-checkout",
};

export function detectAutoMarker(url: string): AutoMarkerMatch | null {
  const kind = classifyWalmartPageKind(url);
  const label = KIND_TO_MARKER[kind];
  if (!label) {
    return null;
  }
  if (kind === "checkout") {
    const detail = checkoutStepFromPath(url);
    return detail ? { label, detail } : { label };
  }
  return { label };
}
