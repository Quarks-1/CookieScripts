import type { MainAddToCartWaitState } from "@ext/lib/retailer/main-add-to-cart.ts";

export function shouldUseBackendAtc(
  backendAtcEnabled: boolean,
  frontendAtcEnabled: boolean,
  effectiveQuantity: number,
  waitStateKind: MainAddToCartWaitState["kind"],
): boolean {
  if (!backendAtcEnabled) {
    return false;
  }

  if (waitStateKind === "ready" && frontendAtcEnabled) {
    return false;
  }

  if (effectiveQuantity > 1) {
    return true;
  }

  return (
    waitStateKind === "waiting_disabled" ||
    (waitStateKind === "ready" && !frontendAtcEnabled)
  );
}

export function shouldSetPageQuantityBeforeAtc(
  frontendAtcEnabled: boolean,
  backendAtcEnabled: boolean,
  effectiveQuantity: number,
): boolean {
  return frontendAtcEnabled && effectiveQuantity > 1 && !backendAtcEnabled;
}
