import { flushRecentUrls, initRuntimeState, onTabRemoved } from "@ext/core/background/runtime-state.ts";
import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { onRetailerTabRemoved, onRetailerWindowRemoved } from "@ext/domains/target/background/runtime-state.ts";
import { onWalmartTabRemoved, loadWalmartRecordingState } from "@ext/domains/walmart/background/handlers/index.ts";
import {
  onAutoRefreshTabRemoved,
  onAutoRefreshTabUpdated,
} from "@ext/domains/walmart/background/auto-refresh-tab-events.ts";
import { handleMessage } from "@ext/core/background/handlers.ts";
import { configureSidePanel } from "@ext/core/background/side-panel.ts";
import { seedDefaultsIfMissing } from "@ext/core/lib/storage.ts";

// Chrome disallows top-level await in MV3 service workers — gate handlers on initPromise instead.
const initPromise = initRuntimeState();

chrome.runtime.onInstalled.addListener(() => {
  void initPromise.then(async () => {
    await seedDefaultsIfMissing();
    await configureSidePanel();
  });
});

void initPromise.then(() => {
  void configureSidePanel();
  void loadWalmartRecordingState();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  return initPromise.then(() => handleMessage(message, sender));
});

chrome.tabs.onActivated.addListener(() => {
  void notifyStatusChanged();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void onAutoRefreshTabUpdated(tabId, changeInfo, tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  onAutoRefreshTabRemoved(tabId);
  onTabRemoved(tabId);
  onRetailerTabRemoved(tabId);
  void onWalmartTabRemoved(tabId);
});

chrome.windows.onRemoved.addListener((windowId) => {
  onRetailerWindowRemoved(windowId);
});

if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    void initPromise.then(() => flushRecentUrls());
  });
}
