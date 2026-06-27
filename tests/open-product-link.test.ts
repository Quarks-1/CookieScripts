import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  shouldOpenRetailerWindow,
  openPassiveProductTab,
} from "@ext/background/open-product-link.ts";
import { clearRetailerRuntimeState } from "@ext/background/retailer-runtime-state.ts";
import { DEFAULT_SETTINGS } from "@ext/types/index.ts";
import { buildChannelTarget } from "./fixtures.ts";

describe("open-product-link", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearRetailerRuntimeState();
    vi.stubGlobal("chrome", {
      tabs: {
        create: vi.fn(async () => ({ id: 42 })),
      },
    });
  });

  it("detects retailer window branch", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
          retailer_auto_enabled: true,
        }),
      ],
    };
    expect(
      shouldOpenRetailerWindow(
        "https://www.target.com/p/foo/-/A-123",
        "222",
        settings,
      ),
    ).toBe(true);
    expect(
      shouldOpenRetailerWindow("https://walmart.com/item", "222", settings),
    ).toBe(false);
  });

  it("opens passive tabs in background", async () => {
    await openPassiveProductTab("https://example.com");
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://example.com",
      active: false,
    });
  });
});
