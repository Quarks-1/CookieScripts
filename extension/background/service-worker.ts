import { handleMessage } from "@ext/background/handlers.ts";
import {
  flushRecentUrls,
  initRuntimeState,
  onTabRemoved,
} from "@ext/background/runtime-state.ts";
import { seedDefaultsIfMissing } from "@ext/lib/storage.ts";

// Chrome disallows top-level await in MV3 service workers — gate handlers on initPromise instead.
const initPromise = initRuntimeState();

chrome.runtime.onInstalled.addListener(() => {
  void initPromise.then(() => seedDefaultsIfMissing());
});

chrome.runtime.onMessage.addListener((message, sender) => {
  return initPromise.then(() => handleMessage(message, sender));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  onTabRemoved(tabId);
});

if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    void initPromise.then(() => flushRecentUrls());
  });
}
