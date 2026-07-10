/** Patch isActive on open-tab rows when the user selects a tab in Chrome. */
export function patchRetailerOpenTabActive<T extends { tabId: number; isActive: boolean }>(
  openTabs: readonly T[],
  activatedTabId: number,
): T[] {
  const matchesOpenTab = openTabs.some((tab) => tab.tabId === activatedTabId);
  if (!matchesOpenTab) {
    return openTabs.map((tab) => ({ ...tab, isActive: false }));
  }
  return openTabs.map((tab) => ({
    ...tab,
    isActive: tab.tabId === activatedTabId,
  }));
}

/** Whether this open-tab row is the active tab in the focused browser window. */
export function isRetailerOpenTabActive(
  tabId: number,
  focusedActiveTabId?: number,
): boolean {
  return focusedActiveTabId != null && tabId === focusedActiveTabId;
}

export function applyRetailerOpenTabHighlights<T extends { tabId: number; isActive: boolean }>(
  openTabs: readonly T[],
  focusedActiveTabId?: number,
): T[] {
  if (focusedActiveTabId == null) {
    return openTabs.map((tab) => ({ ...tab, isActive: false }));
  }
  return patchRetailerOpenTabActive(openTabs, focusedActiveTabId);
}
