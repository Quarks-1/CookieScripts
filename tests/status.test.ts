import { describe, expect, it, vi } from "vitest";

import { buildStatus } from "@ext/background/status.ts";
import { activeChannels } from "@ext/background/runtime-state.ts";

vi.mock("@ext/lib/storage.ts", () => ({
  getSettings: vi.fn().mockResolvedValue({ enabled: true, channel_targets: [] }),
  getRetailerProfiles: vi.fn().mockResolvedValue({ target: null }),
}));

describe("buildStatus", () => {
  it("sets retailer_tab_detected when active tab is on target.com", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://www.target.com/p/foo/-/A-123",
    } as chrome.tabs.Tab);
    expect(status.retailer_tab_detected).toBe(true);
  });

  it("clears retailer_tab_detected for non-Target tabs", async () => {
    activeChannels.clear();
    const status = await buildStatus({
      id: 1,
      url: "https://discord.com/channels/111/222",
    } as chrome.tabs.Tab);
    expect(status.retailer_tab_detected).toBe(false);
  });
});
