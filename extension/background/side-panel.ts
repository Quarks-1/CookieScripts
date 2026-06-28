const SIDE_PANEL_PATH = "ui/sidepanel/index.html";

export async function configureSidePanel(): Promise<void> {
  if (!chrome.sidePanel) {
    return;
  }

  await chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
