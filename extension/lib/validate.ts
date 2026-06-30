import type { ChannelTarget } from "@ext/types/index.ts";

function validateChannelId(channelId: string): string | null {
  if (!/^\d+$/.test(channelId)) {
    return "Each channel ID must be a numeric Discord channel ID";
  }
  try {
    if (BigInt(channelId) <= 0n) {
      return "Each channel ID must be a positive integer";
    }
  } catch {
    return "Each channel ID must be a numeric Discord channel ID";
  }
  return null;
}

export function validateChannelTarget(target: ChannelTarget): string | null {
  const idError = validateChannelId(target.channel_id);
  if (idError) {
    return idError;
  }
  if (!target.allowed_domains.length) {
    return "Each channel needs at least one allowed domain";
  }
  if (
    target.retailer_auto_atc_enabled !== undefined &&
    typeof target.retailer_auto_atc_enabled !== "boolean"
  ) {
    return "retailer_auto_atc_enabled must be a boolean";
  }
  if (target.retailer_refresh_interval_sec !== undefined) {
    if (
      typeof target.retailer_refresh_interval_sec !== "number" ||
      !Number.isFinite(target.retailer_refresh_interval_sec) ||
      target.retailer_refresh_interval_sec <= 0 ||
      target.retailer_refresh_interval_sec > 3600
    ) {
      return "retailer_refresh_interval_sec must be between 1 and 3600";
    }
  }
  return null;
}

export function validatePersistedTargets(targets: ChannelTarget[]): string | null {
  const seen = new Set<string>();
  for (const target of targets) {
    const error = validateChannelTarget(target);
    if (error) {
      return error;
    }
    if (seen.has(target.channel_id)) {
      return "Channel IDs must be unique";
    }
    seen.add(target.channel_id);
  }
  return null;
}
