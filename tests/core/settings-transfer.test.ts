import { describe, expect, it } from "vitest";

import {
  buildImportSummary,
  parseSettingsBackupBlob,
  serializeSettingsBackup,
} from "@ext/core/lib/settings-transfer.ts";
import {
  DEFAULT_SETTINGS,
  SETTINGS_BACKUP_MAX_BYTES,
  SETTINGS_BACKUP_TYPE,
  type ExtensionSettings,
  type SettingsBackupBundle,
} from "@ext/core/types/index.ts";

function buildFullBundle(): SettingsBackupBundle {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      enabled: true,
      channel_targets: [
        {
          channel_id: "1234567890123456789",
          allowed_domains: ["target.com", "walmart.com"],
          retailer_refresh_interval_sec: 30,
        },
      ],
      watch_keywords: {
        target: { positive: ["pokemon"], negative: ["scam"] },
        walmart: { positive: ["drop"], negative: [] },
      },
      watch_skus: {
        target: ["95120834"],
        walmart: ["19965460207"],
      },
      open_links_in_window: false,
      sku_open_mode_enabled: true,
      discord_allow_duplicates: true,
      retailer_auto_checkout_mode: "sku_only",
      retailer_schedule_enabled: true,
      retailer_schedule_start_time: "09:00:00",
      retailer_schedule_end_time: "10:00:00",
      walmart_schedule_enabled: true,
      walmart_schedule_start_time: "08:00:00",
      samsclub_checkout_cvv: "123",
      samsclub_schedule_enabled: true,
      samsclub_schedule_start_time: "07:00:00",
      walmart_refresh_interval_sec: 15,
      walmart_throttle_refresh_interval_sec: 12,
    },
    ignored_domains: {
      "999888777666555444": ["spam.com"],
      "1234567890123456789": ["ignored.com"],
    },
    catalog_view: { groupBy: "type" },
  };
}

function wrapBundle(bundle: SettingsBackupBundle): string {
  return serializeSettingsBackup(bundle, {
    exportedAt: "2026-07-31T12:00:00.000Z",
    extensionVersion: "0.1.67",
  });
}

describe("settings-transfer", () => {
  it("round-trips a full backup with pretty JSON", () => {
    const bundle = buildFullBundle();
    const blob = wrapBundle(bundle);
    expect(blob).toContain("\n  ");
    expect(blob).toContain(`"type": "${SETTINGS_BACKUP_TYPE}"`);

    const parsed = parseSettingsBackupBlob(blob);
    expect(parsed.settings.samsclub_checkout_cvv).toBe("123");
    expect(parsed.settings.channel_targets).toHaveLength(1);
    expect(parsed.ignored_domains["999888777666555444"]).toEqual(["spam.com"]);
    expect(parsed.catalog_view).toEqual({ groupBy: "type" });
  });

  it("builds import summary from validated bundle", () => {
    const summary = buildImportSummary(buildFullBundle());
    expect(summary).toEqual({
      enabled: true,
      discord_channel_count: 1,
      target_sku_count: 1,
      walmart_sku_count: 1,
      enabled_schedules: ["target", "walmart", "samsclub"],
      contains_cvv: true,
    });
  });

  it("defaults catalog view grouping to set when omitted in storage export materialization", () => {
    const bundle = buildFullBundle();
    bundle.catalog_view = { groupBy: "set" };
    const summary = buildImportSummary(bundle);
    expect(summary.contains_cvv).toBe(true);
  });

  it("rejects empty clipboard text", () => {
    expect(() => parseSettingsBackupBlob("   ")).toThrow(/empty/i);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSettingsBackupBlob("{not json")).toThrow(/invalid json/i);
  });

  it("rejects unsupported backup version", () => {
    const blob = wrapBundle(buildFullBundle()).replace('"version": 1', '"version": 99');
    expect(() => parseSettingsBackupBlob(blob)).toThrow(/unsupported backup version/i);
  });

  it("rejects unknown root keys", () => {
    const parsed = JSON.parse(wrapBundle(buildFullBundle())) as Record<string, unknown>;
    parsed.extra = true;
    expect(() => parseSettingsBackupBlob(JSON.stringify(parsed))).toThrow(/Unknown field backup\.extra/);
  });

  it("rejects unknown settings keys", () => {
    const parsed = JSON.parse(wrapBundle(buildFullBundle())) as {
      settings: Record<string, unknown>;
    };
    parsed.settings.unknown_toggle = true;
    expect(() => parseSettingsBackupBlob(JSON.stringify(parsed))).toThrow(
      /Unknown field settings\.unknown_toggle/,
    );
  });

  it("rejects invalid CVV", () => {
    const bundle = buildFullBundle();
    bundle.settings.samsclub_checkout_cvv = "12";
    expect(() => parseSettingsBackupBlob(wrapBundle(bundle))).toThrow(/cvv/i);
  });

  it("rejects backups larger than 1 MiB", () => {
    const huge = "a".repeat(SETTINGS_BACKUP_MAX_BYTES + 1);
    expect(() => parseSettingsBackupBlob(huge)).toThrow(/1 MiB/i);
  });

  it("refuses to export a backup that cannot fit the import limit", () => {
    const bundle = buildFullBundle();
    bundle.ignored_domains = {
      "1234567890123456789": [`${"a".repeat(SETTINGS_BACKUP_MAX_BYTES)}.com`],
    };
    expect(() => wrapBundle(bundle)).toThrow(/1 MiB/i);
  });

  it("rejects non-canonical export timestamps", () => {
    const parsed = JSON.parse(wrapBundle(buildFullBundle())) as Record<string, unknown>;
    parsed.exported_at = "July 31, 2026";
    expect(() => parseSettingsBackupBlob(JSON.stringify(parsed))).toThrow(/canonical ISO-8601/i);
  });

  it("rejects non-string domain entries", () => {
    const parsed = JSON.parse(wrapBundle(buildFullBundle())) as {
      settings: { channel_targets: Array<{ allowed_domains: unknown[] }> };
    };
    parsed.settings.channel_targets[0]!.allowed_domains.push(42);
    expect(() => parseSettingsBackupBlob(JSON.stringify(parsed))).toThrow(
      /allowed_domains entries must be strings/i,
    );
  });

  it("accepts orphan ignored-domain channel keys", () => {
    const bundle = buildFullBundle();
    const parsed = parseSettingsBackupBlob(wrapBundle(bundle));
    expect(parsed.ignored_domains["999888777666555444"]).toEqual(["spam.com"]);
  });

  it("migrates legacy ignore_duplicates on import", () => {
    const bundle = buildFullBundle();
    const parsed = JSON.parse(wrapBundle(bundle)) as Record<string, unknown>;
    const settings = parsed.settings as Record<string, unknown>;
    settings.ignore_duplicates = true;
    delete settings.discord_allow_duplicates;

    const imported = parseSettingsBackupBlob(JSON.stringify(parsed));
    expect(imported.settings.discord_allow_duplicates).toBe(true);
  });

  it("strips legacy ignore_duplicates from export output", () => {
    const bundle = buildFullBundle();
    const legacySettings = {
      ...bundle.settings,
      ignore_duplicates: true,
    } as ExtensionSettings & { ignore_duplicates: boolean };
    const blob = serializeSettingsBackup(
      { ...bundle, settings: legacySettings },
      {
        exportedAt: "2026-07-31T12:00:00.000Z",
        extensionVersion: "0.1.67",
      },
    );
    expect(blob).not.toContain("ignore_duplicates");
    expect(blob).toContain('"discord_allow_duplicates": true');
  });

  it("migrates legacy retailer_auto_atc_enabled on import", () => {
    const bundle = buildFullBundle();
    const parsed = JSON.parse(wrapBundle(bundle)) as Record<string, unknown>;
    const settings = parsed.settings as Record<string, unknown>;
    settings.retailer_auto_atc_enabled = true;
    delete settings.retailer_frontend_atc_enabled;
    delete settings.retailer_backend_atc_enabled;
    delete settings._migrations;

    const imported = parseSettingsBackupBlob(JSON.stringify(parsed));
    expect(imported.settings).not.toHaveProperty("retailer_auto_atc_enabled");
    expect(imported.settings._migrations?.atc_pill_v1).toBe(true);
  });

  it("migrates legacy retailer_auto_checkout_enabled on import", () => {
    const parsed = JSON.parse(wrapBundle(buildFullBundle())) as {
      settings: Record<string, unknown>;
    };
    parsed.settings.retailer_auto_checkout_enabled = true;
    delete parsed.settings.retailer_auto_checkout_mode;

    const imported = parseSettingsBackupBlob(JSON.stringify(parsed));
    expect(imported.settings.retailer_auto_checkout_mode).toBe("all");
    expect(imported.settings).not.toHaveProperty("retailer_auto_checkout_enabled");
  });

  it("refuses to export settings that fail import invariants", () => {
    const bundle = buildFullBundle();
    bundle.settings.retailer_schedule_enabled = true;
    delete bundle.settings.retailer_schedule_start_time;
    expect(() => wrapBundle(bundle)).toThrow(/Start time is required/i);
  });

  it("rejects overlapping keyword lists", () => {
    const bundle = buildFullBundle();
    bundle.settings.watch_keywords = {
      target: { positive: ["scam"], negative: ["scam"] },
    };
    expect(() => parseSettingsBackupBlob(wrapBundle(bundle))).toThrow(/overlap/i);
  });
});
