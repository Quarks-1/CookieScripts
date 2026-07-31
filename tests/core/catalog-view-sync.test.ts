import { describe, expect, it } from "vitest";

import { normalizeCatalogViewGroupBy } from "@ext/core/lib/settings-transfer.ts";

describe("normalizeCatalogViewGroupBy", () => {
  it("defaults to set when persisted view is missing", () => {
    expect(normalizeCatalogViewGroupBy(undefined)).toBe("set");
  });

  it("preserves type grouping", () => {
    expect(normalizeCatalogViewGroupBy({ groupBy: "type" })).toBe("type");
  });

  it("falls back to set for invalid persisted values", () => {
    expect(normalizeCatalogViewGroupBy({ groupBy: "invalid" as "set" })).toBe("set");
  });
});
