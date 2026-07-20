import { applySamsclubOpenTabHighlights } from "@ext/domains/samsclub/lib/open-tab-active.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";

/** Resolve the active content tab in the window hosting this side panel. */
export async function querySidePanelWindowActiveTabId(): Promise<number | undefined> {
  const currentWindow = await chrome.windows.getCurrent();
  if (currentWindow.id == null) {
    return undefined;
  }
  const [activeTab] = await chrome.tabs.query({ active: true, windowId: currentWindow.id });
  return activeTab?.id;
}

export async function enrichSamsclubOpenTabHighlights(
  status: ExtensionStatus,
): Promise<ExtensionStatus> {
  if (status.samsclub_open_tabs.length === 0) {
    return status;
  }
  const activeTabId = await querySidePanelWindowActiveTabId();
  return {
    ...status,
    samsclub_open_tabs: applySamsclubOpenTabHighlights(status.samsclub_open_tabs, activeTabId),
  };
}
