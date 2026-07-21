import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ext/core/lib/storage.ts", () => ({
  getSettings: vi.fn(),
  prependHistory: vi.fn(),
}));

import { handleRetailerMessage } from "@ext/domains/target/background/handlers.ts";
import {
  clearRetailerRuntimeState,
  setRetailerTabUiState,
} from "@ext/domains/target/background/runtime-state.ts";
import { mockRetailerContentSender } from "../fixtures/fixtures.ts";

describe("RETAILER_CLOSE_TAB_ON_OOS", () => {
  beforeEach(() => {
    clearRetailerRuntimeState();
    vi.stubGlobal("chrome", {
      tabs: {
        remove: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockRejectedValue(new Error("Receiving end does not exist.")),
      },
    });
  });

  it("stops auto and removes the tab when running on a product page", async () => {
    setRetailerTabUiState(2, { status: "Waiting for restock…", running: true });
    const sender = mockRetailerContentSender({
      tabId: 2,
      tabUrl: "https://www.target.com/p/foo/-/A-123",
    });

    const response = await handleRetailerMessage(
      { type: "RETAILER_CLOSE_TAB_ON_OOS" },
      sender,
    );

    expect(response).toEqual({ ok: true });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(2);
  });

  it("rejects when tab is not in auto mode", async () => {
    setRetailerTabUiState(2, { status: "Ready", running: false });
    const sender = mockRetailerContentSender({
      tabId: 2,
      tabUrl: "https://www.target.com/p/foo/-/A-123",
    });

    const response = await handleRetailerMessage(
      { type: "RETAILER_CLOSE_TAB_ON_OOS" },
      sender,
    );

    expect(response).toEqual({ ok: false, error: "Tab not in auto mode" });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });
});
