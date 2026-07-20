import { resolveActiveTabKind } from "@ext/core/lib/active-tab.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";

/** Fast client-side sync for side panel tab following before GET_STATUS returns. */
export function patchStatusActiveTabKind(
  status: ExtensionStatus,
  url?: string | null,
): ExtensionStatus {
  const kind = resolveActiveTabKind(url);
  const retailerTabDetected = kind === "retailer";
  const walmartTabDetected = kind === "walmart";
  const samsclubTabDetected = kind === "samsclub";
  if (
    kind === status.active_tab_kind &&
    retailerTabDetected === status.retailer_tab_detected &&
    walmartTabDetected === status.walmart_tab_detected &&
    samsclubTabDetected === status.samsclub_tab_detected
  ) {
    return status;
  }
  return {
    ...status,
    active_tab_kind: kind,
    retailer_tab_detected: retailerTabDetected,
    walmart_tab_detected: walmartTabDetected,
    samsclub_tab_detected: samsclubTabDetected,
  };
}
