import { applyWalmartOpenTabHighlights } from "@ext/lib/walmart/open-tab-active.ts";
import type { ExtensionStatus } from "@ext/types/index.ts";

/** Resolve the active content tab in the window hosting this side panel. */
export async function querySidePanelWindowActiveTabId(): Promise<number | undefined> {
  const currentWindow = await chrome.windows.getCurrent();
  if (currentWindow.id == null) {
    return undefined;
  }
  const [activeTab] = await chrome.tabs.query({ active: true, windowId: currentWindow.id });
  return activeTab?.id;
}

export async function enrichWalmartOpenTabHighlights(
  status: ExtensionStatus,
): Promise<ExtensionStatus> {
  if (status.walmart_open_tabs.length === 0) {
    return status;
  }
  const activeTabId = await querySidePanelWindowActiveTabId();
  return {
    ...status,
    walmart_open_tabs: applyWalmartOpenTabHighlights(status.walmart_open_tabs, activeTabId),
  };
}
