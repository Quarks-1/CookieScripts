import { describe, expect, it } from "vitest";

import {
  activeTabKindToSidepanelTab,
  isSupportedActiveTabKind,
  resolveSidepanelTabForActiveTabChange,
} from "../../ui/popup/core/sidepanel-tabs.ts";

describe("activeTabKindToSidepanelTab", () => {
  it("maps each ActiveTabKind to the correct side panel segment", () => {
    expect(activeTabKindToSidepanelTab("discord_channel")).toBe("discord");
    expect(activeTabKindToSidepanelTab("retailer")).toBe("target");
    expect(activeTabKindToSidepanelTab("walmart")).toBe("walmart");
    expect(activeTabKindToSidepanelTab("other")).toBe("global");
  });
});

describe("isSupportedActiveTabKind", () => {
  it("treats discord, retailer, and walmart as supported", () => {
    expect(isSupportedActiveTabKind("discord_channel")).toBe(true);
    expect(isSupportedActiveTabKind("retailer")).toBe(true);
    expect(isSupportedActiveTabKind("walmart")).toBe(true);
    expect(isSupportedActiveTabKind("other")).toBe(false);
  });
});

describe("resolveSidepanelTabForActiveTabChange", () => {
  it("initializes from active_tab_kind", () => {
    expect(resolveSidepanelTabForActiveTabChange("walmart", null, null)).toBe("walmart");
    expect(resolveSidepanelTabForActiveTabChange("other", null, null)).toBe("global");
  });

  it("follows supported domain changes", () => {
    expect(resolveSidepanelTabForActiveTabChange("walmart", "retailer", "target")).toBe(
      "walmart",
    );
    expect(resolveSidepanelTabForActiveTabChange("retailer", "walmart", "walmart")).toBe(
      "target",
    );
  });

  it("keeps manual selection while active_tab_kind is unchanged", () => {
    expect(resolveSidepanelTabForActiveTabChange("walmart", "walmart", "target")).toBeNull();
  });

  it("does not override manual selection when switching to unsupported tabs", () => {
    expect(resolveSidepanelTabForActiveTabChange("other", "walmart", "target")).toBeNull();
  });
});
