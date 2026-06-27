import {
  enabledDomains,
  pillsFromDomains,
  type DomainPill,
} from "@ext/lib/domains.ts";
import type { ChannelTarget, ExtensionSettings } from "@ext/types/index.ts";

export interface ChannelTargetDraft {
  key: string;
  channel_id: string;
  pills: DomainPill[];
}

export function newDraft(channelId = "", domains: string[] = []): ChannelTargetDraft {
  return {
    key: crypto.randomUUID(),
    channel_id: channelId,
    pills: pillsFromDomains(domains),
  };
}

export function targetsToDrafts(targets: ChannelTarget[]): ChannelTargetDraft[] {
  if (!targets.length) {
    return [newDraft()];
  }
  return targets.map((target) => newDraft(target.channel_id, target.allowed_domains));
}

export function draftsToTargets(drafts: ChannelTargetDraft[]): ChannelTarget[] {
  return drafts.map((draft) => ({
    channel_id: draft.channel_id.trim(),
    allowed_domains: enabledDomains(draft.pills),
  }));
}

export function settingsFingerprint(settings: ExtensionSettings): string {
  return JSON.stringify(settings);
}
