import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ext/core/background/status-notify.ts", () => ({
  notifyStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearRetailerManualAutoStopped,
  clearRetailerRuntimeState,
  getRetailerTabPurchaseLimit,
  getRetailerTabUiState,
  isRetailerManualAutoStopped,
  markRetailerManualAutoStopped,
  normalizeRetailerTabUrl,
  setRetailerTabPurchaseLimit,
  stopRetailerTabAuto,
} from "@ext/domains/target/background/runtime-state.ts";

describe("retailer runtime manual auto stop", () => {
  beforeEach(() => {
    clearRetailerRuntimeState();
    vi.stubGlobal("chrome", {
      tabs: {
        sendMessage: vi.fn().mockRejectedValue(new Error("Receiving end does not exist.")),
      },
    });
  });

  it("persists stop state in the service worker when the tab cannot receive messages", async () => {
    await stopRetailerTabAuto(42);

    expect(isRetailerManualAutoStopped(42)).toBe(true);
    expect(getRetailerTabUiState(42)).toEqual({ status: "Stopped", running: false });
  });

  it("clears stop state when manual auto starts again", () => {
    markRetailerManualAutoStopped(7);
    clearRetailerManualAutoStopped(7);

    expect(isRetailerManualAutoStopped(7)).toBe(false);
    expect(getRetailerTabUiState(7).status).toContain("Ready");
  });

  it("ignores cached purchase limits from a different tab URL", () => {
    setRetailerTabPurchaseLimit(
      9,
      "https://www.target.com/p/old/-/A-111",
      2,
    );

    expect(
      getRetailerTabPurchaseLimit(9, "https://www.target.com/p/new/-/A-222#lnk=sametab"),
    ).toBeUndefined();
    expect(
      getRetailerTabPurchaseLimit(9, "https://www.target.com/p/old/-/A-111"),
    ).toBe(2);
    expect(normalizeRetailerTabUrl("https://www.target.com/p/x/-/A-1#foo")).toBe(
      "https://www.target.com/p/x/-/A-1",
    );
  });
});
