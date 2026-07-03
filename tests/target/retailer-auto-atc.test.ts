import { describe, expect, it } from "vitest";

import {
  getRetailerAutoAtcEnabled,
  migrateRetailerAutoAtcChannelFlags,
  setRetailerAutoAtcEnabled,
} from "@ext/domains/target/lib/channel-config.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { buildChannelTarget } from "../fixtures/fixtures.ts";

describe("getRetailerAutoAtcEnabled", () => {
  it("returns true when per-channel flag is set", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["mavely.app.link"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
    expect(getRetailerAutoAtcEnabled(settings, "222")).toBe(true);
  });

  it("returns false when flag is omitted or off", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [buildChannelTarget({ channel_id: "222", allowed_domains: ["target.com"] })],
    };
    expect(getRetailerAutoAtcEnabled(settings, "222")).toBe(false);
    expect(getRetailerAutoAtcEnabled(settings, "999")).toBe(false);
  });
});

describe("setRetailerAutoAtcEnabled", () => {
  it("persists flag without target.com in allowlist", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({ channel_id: "222", allowed_domains: ["mavely.app.link"] }),
      ],
    };
    const next = setRetailerAutoAtcEnabled(settings, "222", true);
    expect(next.channel_targets[0]?.retailer_auto_atc_enabled).toBe(true);
  });

  it("no-ops when channel has no domains", () => {
    const settings = DEFAULT_SETTINGS;
    const next = setRetailerAutoAtcEnabled(settings, "222", true);
    expect(next).toBe(settings);
  });

  it("omits key when disabled", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
    const next = setRetailerAutoAtcEnabled(settings, "222", false);
    expect(next.channel_targets[0]?.retailer_auto_atc_enabled).toBeUndefined();
  });

  it("preserves channel keywords when toggling auto atc", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
          positive_keywords: ["pokemon"],
          negative_keywords: ["scam"],
        }),
      ],
    };
    const next = setRetailerAutoAtcEnabled(settings, "222", true);
    expect(next.channel_targets[0]).toEqual({
      channel_id: "222",
      allowed_domains: ["target.com"],
      positive_keywords: ["pokemon"],
      negative_keywords: ["scam"],
      retailer_auto_atc_enabled: true,
    });
  });
});

describe("migrateRetailerAutoAtcChannelFlags", () => {
  it("copies legacy retailer_auto_enabled to retailer_auto_atc_enabled", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        {
          channel_id: "222",
          allowed_domains: ["target.com"],
          retailer_auto_enabled: true,
        } as (typeof DEFAULT_SETTINGS.channel_targets)[number] & { retailer_auto_enabled: boolean },
      ],
    };
    const { settings: migrated, changed } = migrateRetailerAutoAtcChannelFlags(settings);
    expect(changed).toBe(true);
    expect(migrated.channel_targets[0]?.retailer_auto_atc_enabled).toBe(true);
    expect(
      (migrated.channel_targets[0] as { retailer_auto_enabled?: boolean }).retailer_auto_enabled,
    ).toBeUndefined();
  });

  it("returns unchanged when no legacy keys exist", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "222",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
    const { settings: migrated, changed } = migrateRetailerAutoAtcChannelFlags(settings);
    expect(changed).toBe(false);
    expect(migrated).toEqual(settings);
  });
});
