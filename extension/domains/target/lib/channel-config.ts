import {
  getChannelTarget,
  mergeChannelTarget,
} from "@ext/core/lib/channel-targets.ts";
import { allowlistIncludesRetailerHost } from "@ext/domains/target/lib/host.ts";
import type { ChannelTarget, ExtensionSettings } from "@ext/core/types/index.ts";

export function normalizeRetailerRefreshIntervalSec(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.floor(value), 3600);
}

export function getRetailerRefreshIntervalSec(
  settings: ExtensionSettings,
  channelId: string,
): number {
  if (channelId !== "manual") {
    const perChannel = getChannelTarget(settings, channelId)?.retailer_refresh_interval_sec;
    if (perChannel !== undefined) {
      return normalizeRetailerRefreshIntervalSec(perChannel);
    }
  }
  return normalizeRetailerRefreshIntervalSec(settings.retailer_refresh_interval_sec ?? 0);
}

export function getRetailerAutoAtcEnabled(settings: ExtensionSettings, channelId: string): boolean {
  const target = getChannelTarget(settings, channelId);
  return target?.retailer_auto_atc_enabled === true;
}

export function setRetailerAutoAtcEnabled(
  settings: ExtensionSettings,
  channelId: string,
  enabled: boolean,
): ExtensionSettings {
  const domains = getChannelTarget(settings, channelId)?.allowed_domains ?? [];
  if (domains.length === 0) {
    return settings;
  }
  return mergeChannelTarget(settings, channelId, {
    allowed_domains: domains,
    retailer_auto_atc_enabled: enabled,
  });
}

type LegacyChannelTarget = ChannelTarget & { retailer_auto_enabled?: boolean };

export function migrateRetailerAutoAtcChannelFlags(settings: ExtensionSettings): {
  settings: ExtensionSettings;
  changed: boolean;
} {
  let changed = false;
  const channel_targets = settings.channel_targets.map((row) => {
    const legacy = row as LegacyChannelTarget;
    if (legacy.retailer_auto_enabled === undefined) {
      return row;
    }

    changed = true;
    const { retailer_auto_enabled: _removed, ...rest } = legacy;
    const next: ChannelTarget = { ...rest };
    if (legacy.retailer_auto_enabled === true && next.retailer_auto_atc_enabled !== true) {
      next.retailer_auto_atc_enabled = true;
    }
    if (next.retailer_auto_atc_enabled !== true) {
      delete next.retailer_auto_atc_enabled;
    }
    return next;
  });

  if (!changed) {
    return { settings, changed: false };
  }

  return { settings: { ...settings, channel_targets }, changed: true };
}

export function setRetailerRefreshInterval(
  settings: ExtensionSettings,
  channelId: string,
  intervalSec: number,
): ExtensionSettings {
  const normalized = normalizeRetailerRefreshIntervalSec(intervalSec);

  if (channelId === "manual") {
    const next = { ...settings };
    if (normalized > 0) {
      next.retailer_refresh_interval_sec = normalized;
    } else {
      delete next.retailer_refresh_interval_sec;
    }
    return next;
  }

  const domains = getChannelTarget(settings, channelId)?.allowed_domains ?? [];
  if (!allowlistIncludesRetailerHost(domains)) {
    return settings;
  }

  return mergeChannelTarget(settings, channelId, {
    allowed_domains: domains,
    retailer_refresh_interval_sec: normalized > 0 ? normalized : undefined,
  });
}

export function getRetailerFrontendAtcEnabled(settings: ExtensionSettings): boolean {
  return settings.retailer_frontend_atc_enabled !== false;
}

export function getRetailerBackendAtcEnabled(settings: ExtensionSettings): boolean {
  return settings.retailer_backend_atc_enabled === true;
}

export function setRetailerAtcModes(
  settings: ExtensionSettings,
  modes: { frontend: boolean; backend: boolean },
): ExtensionSettings {
  if (!modes.frontend && !modes.backend) {
    throw new Error("Enable at least one ATC method");
  }

  const next = { ...settings };
  if (modes.frontend) {
    delete next.retailer_frontend_atc_enabled;
  } else {
    next.retailer_frontend_atc_enabled = false;
  }

  if (modes.backend) {
    next.retailer_backend_atc_enabled = true;
  } else {
    delete next.retailer_backend_atc_enabled;
  }

  return next;
}

export function normalizeRetailerAtcQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

export function getRetailerAtcQuantity(settings: ExtensionSettings): number {
  return normalizeRetailerAtcQuantity(settings.retailer_atc_quantity ?? 1);
}

export function getRetailerUseMaxQuantity(settings: ExtensionSettings): boolean {
  return settings.retailer_use_max_quantity === true;
}

export function setRetailerAtcQuantity(
  settings: ExtensionSettings,
  options: { quantity: number; useMaxQuantity: boolean },
): ExtensionSettings {
  const quantity = normalizeRetailerAtcQuantity(options.quantity);
  const next = { ...settings };

  if (quantity === 1) {
    delete next.retailer_atc_quantity;
  } else {
    next.retailer_atc_quantity = quantity;
  }

  if (options.useMaxQuantity) {
    next.retailer_use_max_quantity = true;
  } else {
    delete next.retailer_use_max_quantity;
  }

  return next;
}

export function getRetailerAutoCheckoutEnabled(settings: ExtensionSettings): boolean {
  return settings.retailer_auto_checkout_enabled === true;
}

export function setRetailerAutoCheckoutEnabled(
  settings: ExtensionSettings,
  enabled: boolean,
): ExtensionSettings {
  const next = { ...settings };
  if (enabled) {
    next.retailer_auto_checkout_enabled = true;
  } else {
    delete next.retailer_auto_checkout_enabled;
  }
  return next;
}

export function normalizeRetailerLinkOpenCount(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

export function getRetailerLinkOpenCount(settings: ExtensionSettings): number {
  return normalizeRetailerLinkOpenCount(settings.retailer_link_open_count ?? 1);
}

export function setRetailerLinkOpenCount(
  settings: ExtensionSettings,
  count: number,
): ExtensionSettings {
  const normalized = normalizeRetailerLinkOpenCount(count);
  const next = { ...settings };
  if (normalized === 1) {
    delete next.retailer_link_open_count;
  } else {
    next.retailer_link_open_count = normalized;
  }
  return next;
}
