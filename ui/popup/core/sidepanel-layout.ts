import type { ActiveTabKind, ExtensionStatus } from "@ext/core/types/index.ts";

export type SidepanelSection =
  | "watchStatus"
  | "channelDomains"
  | "detectedLinks"
  | "retailerAuto"
  | "walmartResearch"
  | "linkHistory"
  | "globalHint";

const VISIBILITY: Record<SidepanelSection, ActiveTabKind | "always"> = {
  watchStatus: "discord_channel",
  channelDomains: "discord_channel",
  detectedLinks: "discord_channel",
  retailerAuto: "retailer",
  walmartResearch: "walmart",
  globalHint: "other",
  linkHistory: "discord_channel",
};

export function isSectionVisible(
  section: SidepanelSection,
  status: ExtensionStatus,
): boolean {
  if (section === "walmartResearch") {
    if (!status.enabled) {
      return false;
    }
    return (
      status.active_tab_kind === "walmart" ||
      status.walmart_recording_active ||
      status.any_walmart_tab_open
    );
  }

  if (section === "retailerAuto") {
    if (!status.enabled) {
      return false;
    }
    return (
      status.active_tab_kind === "retailer" ||
      status.any_retailer_tab_open
    );
  }

  const rule = VISIBILITY[section];
  if (rule === "always") {
    return true;
  }
  if (status.active_tab_kind !== rule) {
    return false;
  }
  return true;
}