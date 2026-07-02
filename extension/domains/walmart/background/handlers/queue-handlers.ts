import { notifyStatusChanged } from "@ext/core/background/status-notify.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import { listAllWalmartTabs } from "@ext/domains/walmart/background/tabs.ts";
import {
  isWalmartTabRecording,
} from "@ext/domains/walmart/background/runtime-state.ts";
import {
  isWalmartHomeUrl,
  planTabConsolidation,
} from "@ext/domains/walmart/lib/tab-consolidation.ts";
import type { BackgroundResponse, WalmartToBackground } from "@ext/core/types/index.ts";
import type { MarkerLabel } from "@ext/domains/walmart/types/walmart.ts";

function resolveHomepageTabId(
  tabs: chrome.tabs.Tab[],
  senderTab?: chrome.tabs.Tab,
  trigger?: string,
): number | undefined {
  if (
    senderTab?.id != null &&
    senderTab.url &&
    isWalmartHomeUrl(senderTab.url) &&
    (trigger === "queue_banner" || trigger === "hold_spot")
  ) {
    return senderTab.id;
  }
  const homeTabs = tabs
    .filter(
      (tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
        tab.id != null && typeof tab.url === "string" && isWalmartHomeUrl(tab.url),
    )
    .sort((a, b) => a.id - b.id);
  return homeTabs[0]?.id;
}

export async function handleWalmartQueuePass(
  message: Extract<WalmartToBackground, { type: "WALMART_QUEUE_PASS" }>,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { ok: true };
  }

  await notifyStatusChanged();

  const tabId = sender.tab?.id;
  if (tabId != null && isWalmartTabRecording(tabId)) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "WALMART_RECORDING_MARK",
        label: "Past queue" satisfies MarkerLabel,
      });
    } catch {
      // Tab may be navigating.
    }
  }

  void message;
  return { ok: true };
}

export async function handleWalmartQueueTabConsolidateRequest(
  message: Extract<WalmartToBackground, { type: "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST" }>,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  const settings = await getSettings();
  if (!settings.enabled || settings.walmart_consolidate_queue_tabs_enabled === false) {
    return { ok: true };
  }

  const senderTabId = sender.tab?.id;
  if (senderTabId == null) {
    return { ok: false, error: "Unauthorized sender" };
  }

  const tabs = await listAllWalmartTabs();
  const tabInfos = tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id != null)
    .map((tab) => ({ id: tab.id, url: tab.url }));

  const homepageTabId = resolveHomepageTabId(tabs, sender.tab, message.trigger);
  const protectedIds = new Set<number>([senderTabId]);
  if (homepageTabId != null) {
    protectedIds.add(homepageTabId);
  }

  const toClose = planTabConsolidation(tabInfos, homepageTabId).filter(
    (id) => !protectedIds.has(id),
  );

  if (toClose.length > 0) {
    await Promise.all(toClose.map((tabId) => chrome.tabs.remove(tabId).catch(() => undefined)));
  }

  void message.trigger;
  return { ok: true };
}
