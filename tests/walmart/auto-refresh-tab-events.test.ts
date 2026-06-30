import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  onAutoRefreshTabRemoved,
  onAutoRefreshTabUpdated,
} from "@ext/domains/walmart/background/auto-refresh-tab-events.ts";
import {
  clearWalmartRuntimeState,
  getWalmartTabAutoRefresh,
  setWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";

describe("walmart auto-refresh tab events", () => {
  beforeEach(() => {
    clearWalmartRuntimeState();
    vi.stubGlobal("chrome", {
      tabs: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("clears state when tab navigates off walmart.com", async () => {
    setWalmartTabAutoRefresh(5, { enabled: true, interval_sec: 10 });
    await onAutoRefreshTabUpdated(
      5,
      { url: "https://www.google.com/" },
      { url: "https://www.google.com/" } as chrome.tabs.Tab,
    );
    expect(getWalmartTabAutoRefresh(5)).toBeUndefined();
  });

  it("clears state on tab removed", () => {
    setWalmartTabAutoRefresh(5, { enabled: true, interval_sec: 10 });
    onAutoRefreshTabRemoved(5);
    expect(getWalmartTabAutoRefresh(5)).toBeUndefined();
  });
});
