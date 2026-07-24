import { describe, expect, it } from "vitest";

import { getCollapsedPillSlice } from "@shared/components/CollapsiblePillList.tsx";

describe("pill-list-collapse", () => {
  const items = Array.from({ length: 20 }, (_, index) => `sku-${index + 1}`);

  it("does not truncate when collapseAfter is unset", () => {
    expect(getCollapsedPillSlice(items, undefined, false)).toEqual({
      visibleItems: items,
      hiddenCount: 0,
    });
  });

  it("does not truncate when count is within collapseAfter", () => {
    expect(getCollapsedPillSlice(items.slice(0, 10), 15, false)).toEqual({
      visibleItems: items.slice(0, 10),
      hiddenCount: 0,
    });
  });

  it("truncates only when collapseAfter is exceeded and not expanded", () => {
    expect(getCollapsedPillSlice(items, 15, false)).toEqual({
      visibleItems: items.slice(0, 15),
      hiddenCount: 5,
    });
  });

  it("shows all items when expanded", () => {
    expect(getCollapsedPillSlice(items, 15, true)).toEqual({
      visibleItems: items,
      hiddenCount: 0,
    });
  });
});
