import { describe, expect, it } from "vitest";

import type { ExtensionStatus } from "@ext/types/index.ts";
import { isSectionVisible } from "../ui/popup/sidepanel-layout.ts";

function status(overrides: Partial<ExtensionStatus>): ExtensionStatus {
  return {
    enabled: true,
    active_tab_kind: "other",
    discord_tab_detected: false,
    retailer_tab_detected: false,
    walmart_tab_detected: false,
    walmart_recording_active: false,
    walmart_recording_tab_count: 0,
    any_walmart_tab_open: false,
    walmart_recording_event_count: 0,
    walmart_recording_bytes: 0,
    walmart_recording_drop_date: null,
    walmart_last_export_path: null,
    walmart_last_export_download_id: null,
    walmart_open_tabs: [],
    active_channel_id: null,
    is_active: false,
    has_allowed_domains: false,
    allowed_domains: [],
    retailer_auto_atc_enabled: false,
    retailer_refresh_interval_sec: 0,
    retailer_frontend_atc_enabled: true,
    retailer_backend_atc_enabled: false,
    retailer_manual_status: "",
    retailer_manual_running: false,
    retailer_atc_quantity: 1,
    retailer_use_max_quantity: false,
    retailer_purchase_limit: null,
    retailer_quantity_invalid: false,
    retailer_auto_start_blocked: false,
    retailer_auto_checkout_enabled: false,
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

  it("shows walmart research on walmart surface, when recording, or when any walmart tab is open", () => {
    const walmart = status({ active_tab_kind: "walmart", walmart_tab_detected: true });
    const paused = status({
      active_tab_kind: "walmart",
      walmart_tab_detected: true,
      enabled: false,
    });
    const discordRecording = status({
      active_tab_kind: "discord_channel",
      walmart_recording_active: true,
    });
    const discordWithWalmartTab = status({
      active_tab_kind: "discord_channel",
      any_walmart_tab_open: true,
    });

    expect(isSectionVisible("walmartResearch", walmart)).toBe(true);
    expect(isSectionVisible("walmartResearch", paused)).toBe(false);
    expect(isSectionVisible("walmartResearch", status({ active_tab_kind: "other" }))).toBe(false);
    expect(isSectionVisible("walmartResearch", discordRecording)).toBe(true);
    expect(isSectionVisible("walmartResearch", discordWithWalmartTab)).toBe(true);
  });
});
