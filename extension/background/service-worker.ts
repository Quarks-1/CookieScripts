import { handleMessage } from "@ext/background/handlers.ts";
import {
  flushRecentUrls,
  initRuntimeState,
  onTabRemoved,
} from "@ext/background/runtime-state.ts";
import { seedDefaultsIfMissing } from "@ext/lib/storage.ts";

await initRuntimeState();

chrome.runtime.onInstalled.addListener(() => {
  void seedDefaultsIfMissing();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  return handleMessage(message, sender);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  onTabRemoved(tabId);
});

if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    void flushRecentUrls();
  });
}
