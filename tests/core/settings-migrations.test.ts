import { describe, expect, it } from "vitest";

import { migrateSettingsAtcPillV1 } from "@ext/core/lib/settings-migrations.ts";
import {
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
} from "@ext/domains/target/lib/channel-config.ts";

const BASE_SETTINGS = {
  channel_targets: [],
  enabled: true,
};

describe("migrateSettingsAtcPillV1", () => {
  it("migrates auto_atc true with implicit frontend to Frontend", () => {
    const settings = {
      ...BASE_SETTINGS,
      retailer_auto_atc_enabled: true,
    };
    const next = migrateSettingsAtcPillV1(settings);
    expect(getRetailerFrontendAtcEnabled(next)).toBe(true);
    expect(getRetailerBackendAtcEnabled(next)).toBe(false);
    expect((next as { retailer_auto_atc_enabled?: boolean }).retailer_auto_atc_enabled).toBeUndefined();
    expect(next._migrations?.atc_pill_v1).toBe(true);
  });

  it("migrates auto_atc true with backend on to Both", () => {
    const settings = {
      ...BASE_SETTINGS,
      retailer_auto_atc_enabled: true,
      retailer_backend_atc_enabled: true,
    };
    const next = migrateSettingsAtcPillV1(settings);
    expect(getRetailerFrontendAtcEnabled(next)).toBe(true);
    expect(getRetailerBackendAtcEnabled(next)).toBe(true);
    expect(next.retailer_frontend_atc_enabled).toBeUndefined();
    expect(next.retailer_backend_atc_enabled).toBe(true);
  });

  it("migrates auto_atc false/absent with implicit frontend to Off", () => {
    const next = migrateSettingsAtcPillV1(BASE_SETTINGS);
    expect(getRetailerFrontendAtcEnabled(next)).toBe(false);
    expect(getRetailerBackendAtcEnabled(next)).toBe(false);
    expect(next.retailer_frontend_atc_enabled).toBe(false);
  });

  it("leaves already Off settings unchanged", () => {
    const settings = {
      ...BASE_SETTINGS,
      retailer_frontend_atc_enabled: false,
    };
    const next = migrateSettingsAtcPillV1(settings);
    expect(getRetailerFrontendAtcEnabled(next)).toBe(false);
    expect(next.retailer_frontend_atc_enabled).toBe(false);
  });

  it("leaves already Both settings unchanged", () => {
    const settings = {
      ...BASE_SETTINGS,
      retailer_backend_atc_enabled: true,
    };
    const next = migrateSettingsAtcPillV1(settings);
    expect(getRetailerFrontendAtcEnabled(next)).toBe(true);
    expect(getRetailerBackendAtcEnabled(next)).toBe(true);
    expect(next.retailer_frontend_atc_enabled).toBeUndefined();
  });

  it("is idempotent", () => {
    const once = migrateSettingsAtcPillV1(BASE_SETTINGS);
    const twice = migrateSettingsAtcPillV1(once);
    expect(twice).toEqual(once);
  });
});
