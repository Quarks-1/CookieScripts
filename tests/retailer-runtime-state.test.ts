import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRetailerManualAutoStopped,
  clearRetailerRuntimeState,
  getRetailerTabUiState,
  isRetailerManualAutoStopped,
  markRetailerManualAutoStopped,
  stopRetailerTabAuto,
} from "@ext/background/retailer-runtime-state.ts";

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
});
