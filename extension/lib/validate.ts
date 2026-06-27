import type { ChannelTarget } from "@ext/types/index.ts";

export function validateChannelTargets(targets: ChannelTarget[]): string | null {
  if (!targets.length) {
    return "Add at least one channel";
  }

  const seen = new Set<string>();
  for (const target of targets) {
    if (!/^\d+$/.test(target.channel_id)) {
      return "Each channel ID must be a numeric Discord channel ID";
    }
    try {
      if (BigInt(target.channel_id) <= 0n) {
        return "Each channel ID must be a positive integer";
      }
    } catch {
      return "Each channel ID must be a numeric Discord channel ID";
    }
    if (seen.has(target.channel_id)) {
      return "Channel IDs must be unique";
    }
    seen.add(target.channel_id);
    if (!target.allowed_domains.length) {
      return "Each channel needs at least one enabled domain";
    }
  }

  return null;
}

export function assertChannelTargets(targets: ChannelTarget[]): void {
  const error = validateChannelTargets(targets);
  if (error) {
    throw new Error(error);
  }
}
