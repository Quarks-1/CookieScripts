import { describe, expect, it } from "vitest";

import type { ExtensionStatus } from "@ext/types/index.ts";
import { isSectionVisible } from "../ui/popup/sidepanel-layout.ts";

function status(overrides: Partial<ExtensionStatus>): ExtensionStatus {
  return {
    enabled: true,
    active_tab_kind: "other",
    discord_tab_detected: false,
    retailer_tab_detected: false,
    active_channel_id: null,
    is_active: false,
    has_allowed_domains: false,
    allowed_domains: [],
    retailer_auto_enabled: false,
    retailer_refresh_interval_sec: 0,
    retailer_frontend_atc_enabled: true,
    retailer_backend_atc_enabled: false,
    retailer_manual_status: "",
    retailer_manual_running: false,
    ...overrides,
  };
}

describe("isSectionVisible", () => {
  it("shows Discord sections only on discord_channel surface", () => {
    const discord = status({ active_tab_kind: "discord_channel", active_channel_id: "1" });
    const retailer = status({ active_tab_kind: "retailer", retailer_tab_detected: true });
    const other = status({ active_tab_kind: "other" });

    expect(isSectionVisible("watchStatus", discord)).toBe(true);
    expect(isSectionVisible("channelDomains", discord)).toBe(true);
    expect(isSectionVisible("detectedLinks", discord)).toBe(true);

    expect(isSectionVisible("watchStatus", retailer)).toBe(false);
    expect(isSectionVisible("channelDomains", retailer)).toBe(false);
    expect(isSectionVisible("detectedLinks", retailer)).toBe(false);

    expect(isSectionVisible("watchStatus", other)).toBe(false);
    expect(isSectionVisible("globalHint", other)).toBe(true);
    expect(isSectionVisible("globalHint", discord)).toBe(false);
  });

  it("shows retailer auto only on retailer surface when enabled", () => {
    const retailer = status({ active_tab_kind: "retailer", retailer_tab_detected: true });
    const paused = status({
      active_tab_kind: "retailer",
      retailer_tab_detected: true,
      enabled: false,
    });

    expect(isSectionVisible("retailerAuto", retailer)).toBe(true);
    expect(isSectionVisible("retailerAuto", paused)).toBe(false);
    expect(isSectionVisible("retailerAuto", status({ active_tab_kind: "other" }))).toBe(false);
  });

  it("shows link history only on discord_channel surface", () => {
    const discord = status({ active_tab_kind: "discord_channel", active_channel_id: "1" });
    const retailer = status({ active_tab_kind: "retailer", retailer_tab_detected: true });
    const other = status({ active_tab_kind: "other" });

    expect(isSectionVisible("linkHistory", discord)).toBe(true);
    expect(isSectionVisible("linkHistory", retailer)).toBe(false);
    expect(isSectionVisible("linkHistory", other)).toBe(false);
  });
});
