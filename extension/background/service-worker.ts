import { flushRecentUrls, initRuntimeState, onTabRemoved } from "@ext/background/runtime-state.ts";
import { onRetailerTabRemoved, onRetailerWindowRemoved } from "@ext/background/retailer-runtime-state.ts";
import { onWalmartTabRemoved, loadWalmartRecordingState } from "@ext/background/walmart-handlers.ts";
import { handleMessage } from "@ext/background/handlers.ts";
import { configureSidePanel } from "@ext/background/side-panel.ts";
import { seedDefaultsIfMissing } from "@ext/lib/storage.ts";

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

chrome.tabs.onRemoved.addListener((tabId) => {
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
