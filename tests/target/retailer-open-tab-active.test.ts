import { describe, expect, it } from "vitest";

import {
  applyRetailerOpenTabHighlights,
  isRetailerOpenTabActive,
  patchRetailerOpenTabActive,
} from "@ext/domains/target/lib/open-tab-active.ts";

describe("isRetailerOpenTabActive", () => {
  it("matches only the focused active tab id", () => {
    expect(isRetailerOpenTabActive(3, 3)).toBe(true);
    expect(isRetailerOpenTabActive(1, 3)).toBe(false);
    expect(isRetailerOpenTabActive(3, undefined)).toBe(false);
  });
});

describe("applyRetailerOpenTabHighlights", () => {
  it("highlights only the focused active tab id", () => {
    const openTabs = [
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: false },
    ];
    expect(applyRetailerOpenTabHighlights(openTabs, 3)).toEqual([
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: true },
    ]);
  });
});

describe("patchRetailerOpenTabActive", () => {
  it("highlights only the activated retailer tab", () => {
    const openTabs = [
      { tabId: 1, isActive: true },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: false },
    ];
    expect(patchRetailerOpenTabActive(openTabs, 3)).toEqual([
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: true },
    ]);
  });

  it("clears highlights when a non-retailer tab is activated", () => {
    const openTabs = [
      { tabId: 1, isActive: true },
      { tabId: 2, isActive: false },
    ];
    expect(patchRetailerOpenTabActive(openTabs, 99)).toEqual([
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
    ]);
  });
});
