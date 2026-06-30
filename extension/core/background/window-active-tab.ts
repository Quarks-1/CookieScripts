/** Active tab in a browser window (side panel passes its hosting window id). */
export async function getActiveTabInWindow(
  windowId?: number,
): Promise<chrome.tabs.Tab | undefined> {
  if (windowId != null) {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    return tab;
  }

  const focusedWindow = await chrome.windows.getLastFocused();
  if (focusedWindow.id == null) {
    return undefined;
  }
  const [tab] = await chrome.tabs.query({ active: true, windowId: focusedWindow.id });
  return tab;
}
