import type { ActiveTabKind, ExtensionStatus } from "@ext/types/index.ts";

export type SidepanelSection =
  | "watchStatus"
  | "channelDomains"
  | "detectedLinks"
  | "retailerAuto"
  | "linkHistory"
  | "globalHint";

const VISIBILITY: Record<SidepanelSection, ActiveTabKind | "always"> = {
  watchStatus: "discord_channel",
  channelDomains: "discord_channel",
  detectedLinks: "discord_channel",
  retailerAuto: "retailer",
  globalHint: "other",
  linkHistory: "discord_channel",
};

export function isSectionVisible(
  section: SidepanelSection,
  status: ExtensionStatus,
): boolean {
  const rule = VISIBILITY[section];
  if (rule === "always") {
    return true;
  }
  if (status.active_tab_kind !== rule) {
    return false;
  }
  if (section === "retailerAuto") {
    return status.enabled;
  }
  return true;
}
