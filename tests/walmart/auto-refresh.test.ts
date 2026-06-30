import { describe, expect, it } from "vitest";

import {
  WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  normalizeWalmartRefreshIntervalSec,
  shouldWalmartHardRefresh,
} from "@ext/domains/walmart/lib/auto-refresh.ts";

describe("walmart auto-refresh lib", () => {
  it("normalizes interval to 1–3600 with default 10 for empty", () => {
    expect(normalizeWalmartRefreshIntervalSec("")).toBe(10);
    expect(normalizeWalmartRefreshIntervalSec(0)).toBe(1);
    expect(normalizeWalmartRefreshIntervalSec(5000)).toBe(3600);
    expect(normalizeWalmartRefreshIntervalSec(15.7)).toBe(15);
  });

  it("defaults constant is 10", () => {
    expect(WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC).toBe(10);
  });

  it("shouldWalmartHardRefresh respects enabled, pause, and elapsed time", () => {
    const now = 100_000;
    expect(shouldWalmartHardRefresh(now, 0, 10, false, false)).toBe(false);
    expect(shouldWalmartHardRefresh(now, 0, 10, true, true)).toBe(false);
    expect(shouldWalmartHardRefresh(now, now - 5_000, 10, true, false)).toBe(false);
    expect(shouldWalmartHardRefresh(now, now - 10_000, 10, true, false)).toBe(true);
  });
});
