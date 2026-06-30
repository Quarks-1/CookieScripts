import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAllWalmartTabAutoRefresh,
  clearWalmartTabAutoRefresh,
  clearWalmartRuntimeState,
  getWalmartTabAutoRefresh,
  hasWalmartTabAutoRefresh,
  listWalmartTabAutoRefreshTabIds,
  setWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";

describe("walmart tab auto-refresh runtime state", () => {
  beforeEach(() => {
    clearWalmartRuntimeState();
  });

  it("stores and retrieves per-tab state", () => {
    setWalmartTabAutoRefresh(1, { enabled: true, interval_sec: 10 });
    expect(getWalmartTabAutoRefresh(1)).toEqual({ enabled: true, interval_sec: 10 });
    expect(hasWalmartTabAutoRefresh(1)).toBe(true);
  });

  it("lists tab ids and clears one or all", () => {
    setWalmartTabAutoRefresh(1, { enabled: true, interval_sec: 10 });
    setWalmartTabAutoRefresh(2, { enabled: false, interval_sec: 20 });
    expect(listWalmartTabAutoRefreshTabIds().sort()).toEqual([1, 2]);

    clearWalmartTabAutoRefresh(1);
    expect(hasWalmartTabAutoRefresh(1)).toBe(false);
    expect(listWalmartTabAutoRefreshTabIds()).toEqual([2]);

    clearAllWalmartTabAutoRefresh();
    expect(listWalmartTabAutoRefreshTabIds()).toEqual([]);
  });
});
