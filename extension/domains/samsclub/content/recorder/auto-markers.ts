import {
  checkoutStepFromPath,
  classifySamsclubPageKind,
} from "@ext/domains/samsclub/lib/page-kind.ts";
import type { MarkerLabel } from "@ext/domains/samsclub/types/samsclub.ts";

export type AutoMarkerMatch = {
  label: MarkerLabel;
  detail?: string;
};

const KIND_TO_MARKER: Partial<Record<ReturnType<typeof classifySamsclubPageKind>, MarkerLabel>> = {
  blocked: "Blocked",
  search: "Search",
  product: "Product page",
  cart: "Cart page",
  post_checkout: "Post-checkout",
  checkout: "Pre-checkout",
};

export function detectAutoMarker(url: string): AutoMarkerMatch | null {
  const kind = classifySamsclubPageKind(url);
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
