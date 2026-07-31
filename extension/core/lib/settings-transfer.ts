import { stripChannelWatchFields } from "@ext/core/lib/channel-targets.ts";
import { normalizeDomain } from "@ext/core/lib/domains.ts";
import type { IgnoredDomainsMap } from "@ext/core/lib/ignored-domains.ts";
import { migrateSettingsAtcPillV1 } from "@ext/core/lib/settings-migrations.ts";
import {
  isValidScheduleTime,
  normalizeScheduleTime,
} from "@ext/core/lib/schedule-settings.ts";
import {
  validateGlobalWatchSettings,
  validatePersistedTargets,
} from "@ext/core/lib/validate.ts";
import {
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS_PER_LIST,
  MAX_SKU_LENGTH,
  MAX_SKUS_PER_LIST,
} from "@ext/core/lib/constants.ts";
import type {
  ChannelTarget,
  ExtensionSettings,
  RetailerAutoCheckoutMode,
  SamsclubAutoCheckoutMode,
} from "@ext/core/types/index.ts";
import type { CatalogViewPersisted } from "@ext/core/types/catalog.ts";
import {
  SETTINGS_BACKUP_MAX_BYTES,
  SETTINGS_BACKUP_TYPE,
  SETTINGS_BACKUP_VERSION,
  type SettingsBackupBundle,
  type SettingsBackupV1,
  type SettingsImportSummary,
} from "@ext/core/types/settings-transfer.ts";
import { RETAILER_AUTO_CHECKOUT_MODES } from "@ext/domains/target/lib/channel-config.ts";
import { SAMSCLUB_AUTO_CHECKOUT_MODES } from "@ext/domains/samsclub/lib/index.ts";

const BACKUP_ROOT_KEYS = new Set([
  "type",
  "version",
  "exported_at",
  "extension_version",
  "settings",
  "ignored_domains",
  "catalog_view",
]);

const SETTINGS_KEYS = new Set([
  "channel_targets",
  "enabled",
  "watch_keywords",
  "watch_skus",
  "retailer_frontend_atc_enabled",
  "retailer_backend_atc_enabled",
  "retailer_refresh_interval_sec",
  "retailer_atc_quantity",
  "retailer_use_max_quantity",
  "retailer_auto_checkout_mode",
  "retailer_price_gate_enabled",
  "retailer_auto_checkout_enabled",
  "walmart_queue_pass_sound_enabled",
  "walmart_consolidate_queue_tabs_enabled",
  "walmart_throttle_refresh_interval_sec",
  "open_links_in_window",
  "retailer_link_open_count",
  "sku_open_mode_enabled",
  "discord_allow_duplicates",
  "walmart_recording_ui_enabled",
  "samsclub_recording_ui_enabled",
  "samsclub_refresh_interval_sec",
  "samsclub_frontend_atc_enabled",
  "samsclub_backend_atc_enabled",
  "samsclub_atc_quantity",
  "samsclub_use_max_quantity",
  "samsclub_auto_checkout_mode",
  "samsclub_checkout_cvv",
  "retailer_schedule_enabled",
  "retailer_schedule_start_time",
  "retailer_schedule_end_time",
  "retailer_schedule_stop_on_oos",
  "retailer_close_tab_on_oos",
  "samsclub_schedule_enabled",
  "samsclub_schedule_start_time",
  "samsclub_schedule_end_time",
  "samsclub_schedule_stop_on_oos",
  "walmart_schedule_enabled",
  "walmart_schedule_start_time",
  "walmart_schedule_end_time",
  "walmart_refresh_interval_sec",
  "_migrations",
]);

const CHANNEL_TARGET_KEYS = new Set([
  "channel_id",
  "allowed_domains",
  "retailer_refresh_interval_sec",
]);

const WATCH_KEYWORDS_KEYS = new Set(["target", "walmart"]);
const WATCH_SKUS_KEYS = new Set(["target", "walmart"]);
const KEYWORD_BUCKET_KEYS = new Set(["positive", "negative"]);
const MIGRATIONS_KEYS = new Set(["atc_pill_v1"]);
const CATALOG_VIEW_KEYS = new Set(["groupBy"]);

const WATCH_RETAILERS = ["target", "walmart"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown field ${label}.${key}`);
    }
  }
}

function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function assertOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertBoolean(value, label);
}

function assertIntegerInRange(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function assertOptionalIntegerInRange(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertIntegerInRange(value, label, min, max);
}

function assertChannelId(channelId: string): void {
  if (!/^\d+$/.test(channelId)) {
    throw new Error("Each channel ID must be a numeric Discord channel ID");
  }
  try {
    if (BigInt(channelId) <= 0n) {
      throw new Error("Each channel ID must be a positive integer");
    }
  } catch {
    throw new Error("Each channel ID must be a numeric Discord channel ID");
  }
}

function assertIsoTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a canonical ISO-8601 UTC timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO-8601 UTC timestamp`);
  }
  return value;
}

function validateKeywordList(keywords: unknown, label: string): string[] {
  if (!Array.isArray(keywords)) {
    throw new Error(`${label} must be an array`);
  }
  if (keywords.length > MAX_KEYWORDS_PER_LIST) {
    throw new Error(`${label} must have at most ${MAX_KEYWORDS_PER_LIST} entries`);
  }
  const result: string[] = [];
  for (const keyword of keywords) {
    if (typeof keyword !== "string" || keyword.length === 0) {
      throw new Error(`${label} entries must be non-empty strings`);
    }
    if (keyword.length > MAX_KEYWORD_LENGTH) {
      throw new Error(`${label} entries must be at most ${MAX_KEYWORD_LENGTH} characters`);
    }
    result.push(keyword);
  }
  return result;
}

function validateSkuList(skus: unknown, label: string): string[] {
  if (!Array.isArray(skus)) {
    throw new Error(`${label} must be an array`);
  }
  if (skus.length > MAX_SKUS_PER_LIST) {
    throw new Error(`${label} must have at most ${MAX_SKUS_PER_LIST} entries`);
  }
  const result: string[] = [];
  for (const sku of skus) {
    if (typeof sku !== "string" || sku.length === 0) {
      throw new Error(`${label} entries must be non-empty strings`);
    }
    if (sku.length > MAX_SKU_LENGTH) {
      throw new Error(`${label} entries must be at most ${MAX_SKU_LENGTH} characters`);
    }
    if (!/^\d+$/.test(sku)) {
      throw new Error(`${label} entries must be digits only`);
    }
    result.push(sku);
  }
  return result;
}

function validateKeywordOverlap(positive: string[], negative: string[], label: string): void {
  if (positive.length === 0 || negative.length === 0) {
    return;
  }
  const negativeSet = new Set(negative);
  for (const keyword of positive) {
    if (negativeSet.has(keyword)) {
      throw new Error(`${label} positive and negative keywords must not overlap`);
    }
  }
}

function normalizeDomainList(domains: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of domains) {
    const domain = normalizeDomain(raw);
    if (!domain || seen.has(domain)) {
      continue;
    }
    seen.add(domain);
    result.push(domain);
  }
  return result;
}

function validateChannelTargetRow(value: unknown): ChannelTarget {
  if (!isPlainObject(value)) {
    throw new Error("Each channel target must be an object");
  }
  rejectUnknownKeys(value, CHANNEL_TARGET_KEYS, "channel_targets[]");

  if (typeof value.channel_id !== "string") {
    throw new Error("channel_targets[].channel_id must be a string");
  }
  assertChannelId(value.channel_id);

  if (!Array.isArray(value.allowed_domains)) {
    throw new Error("channel_targets[].allowed_domains must be an array");
  }
  if (value.allowed_domains.some((domain) => typeof domain !== "string")) {
    throw new Error("channel_targets[].allowed_domains entries must be strings");
  }
  const allowedDomains = normalizeDomainList(value.allowed_domains as string[]);
  if (allowedDomains.length === 0) {
    throw new Error("Each channel needs at least one allowed domain");
  }

  const row: ChannelTarget = {
    channel_id: value.channel_id,
    allowed_domains: allowedDomains,
  };

  if (value.retailer_refresh_interval_sec !== undefined) {
    row.retailer_refresh_interval_sec = assertIntegerInRange(
      value.retailer_refresh_interval_sec,
      "channel_targets[].retailer_refresh_interval_sec",
      1,
      3600,
    );
  }

  return row;
}

function validateWatchKeywords(value: unknown): ExtensionSettings["watch_keywords"] {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new Error("watch_keywords must be an object");
  }
  rejectUnknownKeys(value, WATCH_KEYWORDS_KEYS, "watch_keywords");

  const next: NonNullable<ExtensionSettings["watch_keywords"]> = {};
  for (const retailer of WATCH_RETAILERS) {
    const bucket = value[retailer];
    if (bucket === undefined) {
      continue;
    }
    if (!isPlainObject(bucket)) {
      throw new Error(`watch_keywords.${retailer} must be an object`);
    }
    rejectUnknownKeys(bucket, KEYWORD_BUCKET_KEYS, `watch_keywords.${retailer}`);
    const positive =
      bucket.positive === undefined
        ? []
        : validateKeywordList(bucket.positive, `watch_keywords.${retailer}.positive`);
    const negative =
      bucket.negative === undefined
        ? []
        : validateKeywordList(bucket.negative, `watch_keywords.${retailer}.negative`);
    validateKeywordOverlap(positive, negative, `watch_keywords.${retailer}`);
    if (positive.length > 0 || negative.length > 0) {
      next[retailer] = { positive, negative };
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function validateWatchSkus(value: unknown): ExtensionSettings["watch_skus"] {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new Error("watch_skus must be an object");
  }
  rejectUnknownKeys(value, WATCH_SKUS_KEYS, "watch_skus");

  const next: NonNullable<ExtensionSettings["watch_skus"]> = {};
  for (const retailer of WATCH_RETAILERS) {
    const skus = value[retailer];
    if (skus === undefined) {
      continue;
    }
    const validated = validateSkuList(skus, `watch_skus.${retailer}`);
    if (validated.length > 0) {
      next[retailer] = validated;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function validateMigrations(value: unknown): ExtensionSettings["_migrations"] {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new Error("_migrations must be an object");
  }
  rejectUnknownKeys(value, MIGRATIONS_KEYS, "_migrations");
  const next: NonNullable<ExtensionSettings["_migrations"]> = {};
  if (value.atc_pill_v1 !== undefined) {
    next.atc_pill_v1 = assertBoolean(value.atc_pill_v1, "_migrations.atc_pill_v1");
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function validateOptionalScheduleTime(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (!isValidScheduleTime(trimmed)) {
    throw new Error(`${label} must be a valid schedule time`);
  }
  return normalizeScheduleTime(trimmed);
}

function validateCheckoutMode(
  value: unknown,
  label: string,
  allowed: ReadonlySet<string>,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function migrateLegacySettingsInput(value: Record<string, unknown>): Record<string, unknown> {
  let next = { ...value };
  if ("ignore_duplicates" in next) {
    if (
      next.discord_allow_duplicates === undefined &&
      typeof next.ignore_duplicates === "boolean"
    ) {
      next.discord_allow_duplicates = next.ignore_duplicates;
    }
    delete next.ignore_duplicates;
  }

  if ("retailer_auto_atc_enabled" in next) {
    const draft = {
      ...next,
      enabled: typeof next.enabled === "boolean" ? next.enabled : true,
      channel_targets: Array.isArray(next.channel_targets)
        ? (next.channel_targets as ChannelTarget[])
        : [],
    } as ExtensionSettings;
    const migrated = migrateSettingsAtcPillV1(draft);
    next = { ...next, ...(migrated as unknown as Record<string, unknown>) };
    delete next.retailer_auto_atc_enabled;
  }

  if ("retailer_auto_checkout_enabled" in next) {
    if (
      next.retailer_auto_checkout_mode === undefined &&
      next.retailer_auto_checkout_enabled === true
    ) {
      next.retailer_auto_checkout_mode = "all";
    }
    delete next.retailer_auto_checkout_enabled;
  }

  return next;
}

export function sanitizeSettingsForExport(settings: ExtensionSettings): ExtensionSettings {
  const source = migrateLegacySettingsInput(
    settings as unknown as Record<string, unknown>,
  ) as unknown as ExtensionSettings;
  const sanitized: ExtensionSettings = {
    enabled: source.enabled,
    channel_targets: source.channel_targets,
  };

  for (const key of SETTINGS_KEYS) {
    if (key === "enabled" || key === "channel_targets") {
      continue;
    }
    const value = source[key as keyof ExtensionSettings];
    if (value !== undefined) {
      (sanitized as unknown as Record<string, unknown>)[key as string] = value;
    }
  }

  return canonicalizeImportedSettings(sanitized);
}

export function validateSettingsForPersistence(value: unknown): ExtensionSettings {
  if (!isPlainObject(value)) {
    throw new Error("settings must be an object");
  }
  const migrated = migrateLegacySettingsInput(value);
  rejectUnknownKeys(migrated, SETTINGS_KEYS, "settings");

  const enabled = assertBoolean(migrated.enabled, "settings.enabled");
  if (!Array.isArray(migrated.channel_targets)) {
    throw new Error("settings.channel_targets must be an array");
  }

  const seenChannelIds = new Set<string>();
  const channel_targets: ChannelTarget[] = [];
  for (const row of migrated.channel_targets) {
    const target = validateChannelTargetRow(row);
    if (seenChannelIds.has(target.channel_id)) {
      throw new Error("Channel IDs must be unique");
    }
    seenChannelIds.add(target.channel_id);
    channel_targets.push(target);
  }

  const settings: ExtensionSettings = {
    enabled,
    channel_targets,
    watch_keywords: validateWatchKeywords(migrated.watch_keywords),
    watch_skus: validateWatchSkus(migrated.watch_skus),
  };

  const optionalBooleans: Array<[keyof ExtensionSettings, string]> = [
    ["retailer_frontend_atc_enabled", "settings.retailer_frontend_atc_enabled"],
    ["retailer_backend_atc_enabled", "settings.retailer_backend_atc_enabled"],
    ["retailer_use_max_quantity", "settings.retailer_use_max_quantity"],
    ["retailer_price_gate_enabled", "settings.retailer_price_gate_enabled"],
    ["retailer_auto_checkout_enabled", "settings.retailer_auto_checkout_enabled"],
    ["walmart_queue_pass_sound_enabled", "settings.walmart_queue_pass_sound_enabled"],
    ["walmart_consolidate_queue_tabs_enabled", "settings.walmart_consolidate_queue_tabs_enabled"],
    ["open_links_in_window", "settings.open_links_in_window"],
    ["sku_open_mode_enabled", "settings.sku_open_mode_enabled"],
    ["discord_allow_duplicates", "settings.discord_allow_duplicates"],
    ["walmart_recording_ui_enabled", "settings.walmart_recording_ui_enabled"],
    ["samsclub_recording_ui_enabled", "settings.samsclub_recording_ui_enabled"],
    ["samsclub_frontend_atc_enabled", "settings.samsclub_frontend_atc_enabled"],
    ["samsclub_backend_atc_enabled", "settings.samsclub_backend_atc_enabled"],
    ["samsclub_use_max_quantity", "settings.samsclub_use_max_quantity"],
    ["retailer_schedule_enabled", "settings.retailer_schedule_enabled"],
    ["retailer_schedule_stop_on_oos", "settings.retailer_schedule_stop_on_oos"],
    ["retailer_close_tab_on_oos", "settings.retailer_close_tab_on_oos"],
    ["samsclub_schedule_enabled", "settings.samsclub_schedule_enabled"],
    ["samsclub_schedule_stop_on_oos", "settings.samsclub_schedule_stop_on_oos"],
    ["walmart_schedule_enabled", "settings.walmart_schedule_enabled"],
  ];

  for (const [key, label] of optionalBooleans) {
    const parsed = assertOptionalBoolean(migrated[key as string], label);
    if (parsed !== undefined) {
      (settings as unknown as Record<string, unknown>)[key as string] = parsed;
    }
  }

  const retailerRefresh = assertOptionalIntegerInRange(
    migrated.retailer_refresh_interval_sec,
    "settings.retailer_refresh_interval_sec",
    0,
    3600,
  );
  if (retailerRefresh !== undefined && retailerRefresh > 0) {
    settings.retailer_refresh_interval_sec = retailerRefresh;
  }

  const samsclubRefresh = assertOptionalIntegerInRange(
    migrated.samsclub_refresh_interval_sec,
    "settings.samsclub_refresh_interval_sec",
    0,
    3600,
  );
  if (samsclubRefresh !== undefined && samsclubRefresh > 0) {
    settings.samsclub_refresh_interval_sec = samsclubRefresh;
  }

  const walmartRefresh = assertOptionalIntegerInRange(
    migrated.walmart_refresh_interval_sec,
    "settings.walmart_refresh_interval_sec",
    1,
    3600,
  );
  if (walmartRefresh !== undefined) {
    settings.walmart_refresh_interval_sec = walmartRefresh;
  }

  const walmartThrottle = assertOptionalIntegerInRange(
    migrated.walmart_throttle_refresh_interval_sec,
    "settings.walmart_throttle_refresh_interval_sec",
    1,
    3600,
  );
  if (walmartThrottle !== undefined) {
    settings.walmart_throttle_refresh_interval_sec = walmartThrottle;
  }

  const retailerAtcQuantity = assertOptionalIntegerInRange(
    migrated.retailer_atc_quantity,
    "settings.retailer_atc_quantity",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  if (retailerAtcQuantity !== undefined && retailerAtcQuantity > 1) {
    settings.retailer_atc_quantity = retailerAtcQuantity;
  }

  const samsclubAtcQuantity = assertOptionalIntegerInRange(
    migrated.samsclub_atc_quantity,
    "settings.samsclub_atc_quantity",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  if (samsclubAtcQuantity !== undefined && samsclubAtcQuantity > 1) {
    settings.samsclub_atc_quantity = samsclubAtcQuantity;
  }

  const linkOpenCount = assertOptionalIntegerInRange(
    migrated.retailer_link_open_count,
    "settings.retailer_link_open_count",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  if (linkOpenCount !== undefined && linkOpenCount !== 1) {
    settings.retailer_link_open_count = linkOpenCount;
  }

  const retailerCheckoutMode = validateCheckoutMode(
    migrated.retailer_auto_checkout_mode,
    "settings.retailer_auto_checkout_mode",
    RETAILER_AUTO_CHECKOUT_MODES,
  ) as RetailerAutoCheckoutMode | undefined;
  if (retailerCheckoutMode !== undefined && retailerCheckoutMode !== "off") {
    settings.retailer_auto_checkout_mode = retailerCheckoutMode;
  }

  const samsclubCheckoutMode = validateCheckoutMode(
    migrated.samsclub_auto_checkout_mode,
    "settings.samsclub_auto_checkout_mode",
    SAMSCLUB_AUTO_CHECKOUT_MODES,
  ) as SamsclubAutoCheckoutMode | undefined;
  if (samsclubCheckoutMode !== undefined && samsclubCheckoutMode !== "off") {
    settings.samsclub_auto_checkout_mode = samsclubCheckoutMode;
  }

  if (migrated.samsclub_checkout_cvv !== undefined) {
    if (
      typeof migrated.samsclub_checkout_cvv !== "string" ||
      !/^\d{3,4}$/.test(migrated.samsclub_checkout_cvv)
    ) {
      throw new Error("samsclub_checkout_cvv must be 3 or 4 digits");
    }
    settings.samsclub_checkout_cvv = migrated.samsclub_checkout_cvv;
  }

  const retailerStart = validateOptionalScheduleTime(
    migrated.retailer_schedule_start_time,
    "settings.retailer_schedule_start_time",
  );
  const retailerEnd = validateOptionalScheduleTime(
    migrated.retailer_schedule_end_time,
    "settings.retailer_schedule_end_time",
  );
  if (retailerStart) {
    settings.retailer_schedule_start_time = retailerStart;
  }
  if (retailerEnd) {
    settings.retailer_schedule_end_time = retailerEnd;
  }

  const samsclubStart = validateOptionalScheduleTime(
    migrated.samsclub_schedule_start_time,
    "settings.samsclub_schedule_start_time",
  );
  const samsclubEnd = validateOptionalScheduleTime(
    migrated.samsclub_schedule_end_time,
    "settings.samsclub_schedule_end_time",
  );
  if (samsclubStart) {
    settings.samsclub_schedule_start_time = samsclubStart;
  }
  if (samsclubEnd) {
    settings.samsclub_schedule_end_time = samsclubEnd;
  }

  const walmartStart = validateOptionalScheduleTime(
    migrated.walmart_schedule_start_time,
    "settings.walmart_schedule_start_time",
  );
  const walmartEnd = validateOptionalScheduleTime(
    migrated.walmart_schedule_end_time,
    "settings.walmart_schedule_end_time",
  );
  if (walmartStart) {
    settings.walmart_schedule_start_time = walmartStart;
  }
  if (walmartEnd) {
    settings.walmart_schedule_end_time = walmartEnd;
  }

  settings._migrations = validateMigrations(migrated._migrations);

  if (settings.retailer_schedule_enabled && !settings.retailer_schedule_start_time) {
    throw new Error("Start time is required when Target schedule is enabled");
  }
  if (
    settings.retailer_schedule_start_time &&
    settings.retailer_schedule_end_time &&
    settings.retailer_schedule_start_time === settings.retailer_schedule_end_time
  ) {
    throw new Error("Target end time must differ from start time");
  }

  if (settings.samsclub_schedule_enabled && !settings.samsclub_schedule_start_time) {
    throw new Error("Start time is required when Sam's Club schedule is enabled");
  }
  if (
    settings.samsclub_schedule_start_time &&
    settings.samsclub_schedule_end_time &&
    settings.samsclub_schedule_start_time === settings.samsclub_schedule_end_time
  ) {
    throw new Error("Sam's Club end time must differ from start time");
  }

  if (settings.walmart_schedule_enabled && !settings.walmart_schedule_start_time) {
    throw new Error("Start time is required when Walmart schedule is enabled");
  }
  if (
    settings.walmart_schedule_start_time &&
    settings.walmart_schedule_end_time &&
    settings.walmart_schedule_start_time === settings.walmart_schedule_end_time
  ) {
    throw new Error("Walmart end time must differ from start time");
  }

  return canonicalizeImportedSettings(settings);
}

function validateIgnoredDomains(value: unknown): IgnoredDomainsMap {
  if (!isPlainObject(value)) {
    throw new Error("ignored_domains must be an object");
  }

  const result: IgnoredDomainsMap = {};
  for (const [channelId, domainsValue] of Object.entries(value)) {
    assertChannelId(channelId);
    if (!Array.isArray(domainsValue)) {
      throw new Error(`ignored_domains.${channelId} must be an array`);
    }
    if (domainsValue.some((domain) => typeof domain !== "string")) {
      throw new Error(`ignored_domains.${channelId} entries must be strings`);
    }
    const domains = normalizeDomainList(domainsValue as string[]);
    if (domains.length > 0) {
      result[channelId] = domains;
    }
  }
  return result;
}

function validateCatalogView(value: unknown): CatalogViewPersisted {
  if (!isPlainObject(value)) {
    throw new Error("catalog_view must be an object");
  }
  rejectUnknownKeys(value, CATALOG_VIEW_KEYS, "catalog_view");
  if (value.groupBy !== "set" && value.groupBy !== "type") {
    throw new Error("catalog_view.groupBy must be set or type");
  }
  return { groupBy: value.groupBy };
}

export function canonicalizeImportedSettings(settings: ExtensionSettings): ExtensionSettings {
  const migrated = migrateSettingsAtcPillV1(settings);
  return stripChannelWatchFields(migrated).settings;
}

export function buildImportSummary(bundle: SettingsBackupBundle): SettingsImportSummary {
  const enabledSchedules: SettingsImportSummary["enabled_schedules"] = [];
  if (bundle.settings.retailer_schedule_enabled) {
    enabledSchedules.push("target");
  }
  if (bundle.settings.walmart_schedule_enabled) {
    enabledSchedules.push("walmart");
  }
  if (bundle.settings.samsclub_schedule_enabled) {
    enabledSchedules.push("samsclub");
  }

  return {
    enabled: bundle.settings.enabled,
    discord_channel_count: bundle.settings.channel_targets.length,
    target_sku_count: bundle.settings.watch_skus?.target?.length ?? 0,
    walmart_sku_count: bundle.settings.watch_skus?.walmart?.length ?? 0,
    enabled_schedules: enabledSchedules,
    contains_cvv:
      typeof bundle.settings.samsclub_checkout_cvv === "string" &&
      bundle.settings.samsclub_checkout_cvv.length > 0,
  };
}

function validateBackupV1(value: Record<string, unknown>): SettingsBackupV1 {
  rejectUnknownKeys(value, BACKUP_ROOT_KEYS, "backup");

  if (value.type !== SETTINGS_BACKUP_TYPE) {
    throw new Error("Invalid backup type");
  }
  if (value.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error("Unsupported backup version");
  }

  const exported_at = assertIsoTimestamp(value.exported_at, "exported_at");
  if (typeof value.extension_version !== "string" || value.extension_version.trim() === "") {
    throw new Error("extension_version must be a non-empty string");
  }

  const settings = validateSettingsForPersistence(value.settings);
  const targetsError = validatePersistedTargets(settings.channel_targets);
  if (targetsError) {
    throw new Error(targetsError);
  }
  const watchError = validateGlobalWatchSettings(settings);
  if (watchError) {
    throw new Error(watchError);
  }

  return {
    type: SETTINGS_BACKUP_TYPE,
    version: SETTINGS_BACKUP_VERSION,
    exported_at,
    extension_version: value.extension_version,
    settings,
    ignored_domains: validateIgnoredDomains(value.ignored_domains),
    catalog_view: validateCatalogView(value.catalog_view),
  };
}

export function parseSettingsBackupBlob(blob: string): SettingsBackupBundle {
  const trimmed = blob.trim();
  if (!trimmed) {
    throw new Error("Clipboard is empty");
  }

  const byteLength = new TextEncoder().encode(trimmed).length;
  if (byteLength > SETTINGS_BACKUP_MAX_BYTES) {
    throw new Error("Backup exceeds 1 MiB limit");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("Backup must be a JSON object");
  }

  const backup = validateBackupV1(parsed);
  return {
    settings: backup.settings,
    ignored_domains: backup.ignored_domains,
    catalog_view: backup.catalog_view,
  };
}

export function serializeSettingsBackup(
  bundle: SettingsBackupBundle,
  options: { exportedAt: string; extensionVersion: string },
): string {
  const candidate = {
    type: SETTINGS_BACKUP_TYPE,
    version: SETTINGS_BACKUP_VERSION,
    exported_at: options.exportedAt,
    extension_version: options.extensionVersion,
    settings: sanitizeSettingsForExport(bundle.settings),
    ignored_domains: bundle.ignored_domains,
    catalog_view: bundle.catalog_view,
  };
  const backup = validateBackupV1(candidate);
  const serialized = JSON.stringify(backup, null, 2);
  const byteLength = new TextEncoder().encode(serialized).length;
  if (byteLength > SETTINGS_BACKUP_MAX_BYTES) {
    throw new Error("Backup exceeds 1 MiB limit");
  }
  return serialized;
}

export function backupContainsCvv(bundle: SettingsBackupBundle): boolean {
  return buildImportSummary(bundle).contains_cvv;
}

export function normalizeCatalogViewGroupBy(
  value: CatalogViewPersisted | undefined,
): CatalogViewPersisted["groupBy"] {
  return value?.groupBy === "type" ? "type" : "set";
}
