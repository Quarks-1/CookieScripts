import { describe, expect, it } from "vitest";

import { patchStatusActiveTabKind } from "../../ui/popup/core/patch-status-active-tab.ts";

function baseStatus(): Parameters<typeof patchStatusActiveTabKind>[0] {
  return {
    active_tab_kind: "retailer",
    retailer_tab_detected: true,
    walmart_tab_detected: false,
  } as Parameters<typeof patchStatusActiveTabKind>[0];
}

describe("patchStatusActiveTabKind", () => {
  it("returns the same object when kind fields are unchanged", () => {
    const status = baseStatus();
    expect(patchStatusActiveTabKind(status, "https://www.target.com/p/foo/-/A-123")).toBe(status);
  });

  it("patches active_tab_kind and tab-detected flags for a new url", () => {
    const status = baseStatus();
    const next = patchStatusActiveTabKind(status, "https://www.walmart.com/ip/example/123");
    expect(next).not.toBe(status);
    expect(next.active_tab_kind).toBe("walmart");
    expect(next.retailer_tab_detected).toBe(false);
    expect(next.walmart_tab_detected).toBe(true);
  });
});
