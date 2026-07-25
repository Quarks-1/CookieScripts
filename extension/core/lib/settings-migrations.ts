import type { ExtensionSettings } from "@ext/core/types/index.ts";

type LegacyExtensionSettings = ExtensionSettings & {
  retailer_auto_atc_enabled?: boolean;
};

export function migrateSettingsAtcPillV1(settings: ExtensionSettings): ExtensionSettings {
  if (settings._migrations?.atc_pill_v1) {
    return settings;
  }

  const legacy = settings as LegacyExtensionSettings;
  const next: ExtensionSettings = { ...settings };

  if (next.retailer_backend_atc_enabled === true) {
    if (next.retailer_frontend_atc_enabled === false) {
      // Backend-only — keep frontend false, backend true.
    } else {
      // Both — omit frontend key (default on), keep backend true.
      delete next.retailer_frontend_atc_enabled;
    }
  } else if (next.retailer_frontend_atc_enabled === false) {
    // Already Off — no ATC key changes.
  } else if (legacy.retailer_auto_atc_enabled === true) {
    // Frontend — omit-when-default keys.
    delete next.retailer_frontend_atc_enabled;
    delete next.retailer_backend_atc_enabled;
  } else {
    // Off — explicit frontend false.
    next.retailer_frontend_atc_enabled = false;
    delete next.retailer_backend_atc_enabled;
  }

  delete (next as LegacyExtensionSettings).retailer_auto_atc_enabled;
  next._migrations = { ...next._migrations, atc_pill_v1: true };

  return next;
}
