import type { ExtensionSettings } from "@ext/core/types/core.ts";
import type { CatalogViewPersisted } from "@ext/core/types/catalog.ts";
import type { IgnoredDomainsMap } from "@ext/core/lib/ignored-domains.ts";

export const SETTINGS_BACKUP_TYPE = "cookiescripts-settings" as const;
export const SETTINGS_BACKUP_VERSION = 1 as const;
export const SETTINGS_BACKUP_MAX_BYTES = 1_048_576;

export type SettingsBackupV1 = {
  type: typeof SETTINGS_BACKUP_TYPE;
  version: typeof SETTINGS_BACKUP_VERSION;
  exported_at: string;
  extension_version: string;
  settings: ExtensionSettings;
  ignored_domains: IgnoredDomainsMap;
  catalog_view: CatalogViewPersisted;
};

export type SettingsImportSummary = {
  enabled: boolean;
  discord_channel_count: number;
  target_sku_count: number;
  walmart_sku_count: number;
  enabled_schedules: ("target" | "walmart" | "samsclub")[];
  contains_cvv: boolean;
};

export type SettingsBackupBundle = {
  settings: ExtensionSettings;
  ignored_domains: IgnoredDomainsMap;
  catalog_view: CatalogViewPersisted;
};
