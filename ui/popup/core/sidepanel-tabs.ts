import type { ActiveTabKind } from "@ext/core/types/index.ts";

export type SidepanelTab = "discord" | "target" | "walmart" | "samsclub" | "global";

export function activeTabKindToSidepanelTab(kind: ActiveTabKind): SidepanelTab {
  switch (kind) {
    case "discord_channel":
      return "discord";
    case "retailer":
      return "target";
    case "walmart":
      return "walmart";
    case "samsclub":
      return "samsclub";
    case "other":
      return "global";
  }
}

/** Supported browser surfaces that should drive the side panel domain tab. */
export function isSupportedActiveTabKind(kind: ActiveTabKind): boolean {
  return kind !== "other";
}

/**
 * When the focused browser tab changes, follow supported domains (Discord, Target, Walmart, Sam's Club).
 * Manual tab picks persist until `active_tab_kind` changes; unsupported tabs do not override.
 */
export function resolveSidepanelTabForActiveTabChange(
  kind: ActiveTabKind,
  previousKind: ActiveTabKind | null,
  currentSelected: SidepanelTab | null,
): SidepanelTab | null {
  if (currentSelected === null) {
    return activeTabKindToSidepanelTab(kind);
  }
  if (kind === previousKind) {
    return null;
  }
  if (!isSupportedActiveTabKind(kind)) {
    return null;
  }
  return activeTabKindToSidepanelTab(kind);
}
