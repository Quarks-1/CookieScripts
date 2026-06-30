import { describe, expect, it } from "vitest";

import {
  applyWalmartOpenTabHighlights,
  isWalmartOpenTabActive,
  patchWalmartOpenTabActive,
} from "@ext/lib/walmart/open-tab-active.ts";

describe("isWalmartOpenTabActive", () => {
  it("matches only the focused active tab id", () => {
    expect(isWalmartOpenTabActive(3, 3)).toBe(true);
    expect(isWalmartOpenTabActive(1, 3)).toBe(false);
    expect(isWalmartOpenTabActive(3, undefined)).toBe(false);
  });
});

describe("applyWalmartOpenTabHighlights", () => {
  it("highlights only the focused active tab id", () => {
    const openTabs = [
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: false },
    ];
    expect(applyWalmartOpenTabHighlights(openTabs, 3)).toEqual([
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: true },
    ]);
  });
});

describe("patchWalmartOpenTabActive", () => {
  it("highlights only the activated walmart tab", () => {
    const openTabs = [
      { tabId: 1, isActive: true },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: false },
    ];
    expect(patchWalmartOpenTabActive(openTabs, 3)).toEqual([
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
      { tabId: 3, isActive: true },
    ]);
  });

  it("clears highlights when a non-walmart tab is activated", () => {
    const openTabs = [
      { tabId: 1, isActive: true },
      { tabId: 2, isActive: false },
    ];
    expect(patchWalmartOpenTabActive(openTabs, 99)).toEqual([
      { tabId: 1, isActive: false },
      { tabId: 2, isActive: false },
    ]);
  });
});
