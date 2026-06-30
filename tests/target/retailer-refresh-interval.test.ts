import { describe, expect, it } from "vitest";

import {
  getRetailerRefreshIntervalSec,
  normalizeRetailerRefreshIntervalSec,
  setRetailerRefreshInterval,
} from "@ext/domains/target/lib/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { buildChannelTarget } from "../fixtures/fixtures.ts";

describe("retailer refresh interval", () => {
  it("normalizes invalid values to zero", () => {
    expect(normalizeRetailerRefreshIntervalSec(0)).toBe(0);
    expect(normalizeRetailerRefreshIntervalSec(-5)).toBe(0);
    expect(normalizeRetailerRefreshIntervalSec(30)).toBe(30);
    expect(normalizeRetailerRefreshIntervalSec(9999)).toBe(3600);
  });

  it("stores per-channel refresh interval", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "111",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };

    const next = setRetailerRefreshInterval(settings, "111", 15);
    expect(getRetailerRefreshIntervalSec(next, "111")).toBe(15);
  });

  it("uses global manual fallback when channel is manual", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      retailer_refresh_interval_sec: 20,
    };
    expect(getRetailerRefreshIntervalSec(settings, "manual")).toBe(20);
  });
});
