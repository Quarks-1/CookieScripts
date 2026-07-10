import { getChannelDomains } from "@ext/core/lib/channel-targets.ts";
import {
  getRetailerAtcQuantity,
  getRetailerAutoAtcEnabled,
  getRetailerAutoCheckoutEnabled,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerLinkOpenCount,
  getRetailerRefreshIntervalSec,
  getRetailerUseMaxQuantity,
  setRetailerAtcModes,
  setRetailerAtcQuantity,
  setRetailerAutoAtcEnabled,
  setRetailerAutoCheckoutEnabled,
  setRetailerRefreshInterval,
} from "@ext/domains/target/lib/channel-config.ts";
import { buildQuantityStatusFields } from "@ext/domains/target/lib/quantity-limit.ts";
import { sleep } from "@ext/core/lib/sleep.ts";
import { resolveActiveTabKind } from "@ext/core/lib/active-tab.ts";
import { getOpenLinksInWindow, getSkuOpenModeEnabled } from "@ext/core/lib/watch.ts";
import { getSettings, saveSettings } from "@ext/core/lib/storage.ts";
import { activeChannels } from "@ext/core/background/runtime-state.ts";
import { listAllRetailerTabs } from "@ext/domains/target/background/tabs.ts";
import {
  getRetailerTabPurchaseLimit,
  getRetailerTabUiState,
  normalizeRetailerTabUrl,
  setRetailerTabPurchaseLimit,
} from "@ext/domains/target/background/runtime-state.ts";
import {
  disambiguateOpenTabLabels as disambiguateRetailerOpenTabLabels,
  isRetailerOpenTabActive,
  labelRetailerTab,
} from "@ext/domains/target/lib/index.ts";
import {
  isAnyWalmartRecording,
  isWalmartTabRecording,
  readLastExport,
  readMetrics,
  recordingTabCount,
  getWalmartTabAutoRefresh,
} from "@ext/domains/walmart/background/runtime-state.ts";
import { WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC } from "@ext/domains/walmart/lib/index.ts";
import { listAllWalmartTabs } from "@ext/domains/walmart/background/tabs.ts";
import { parseChannelId } from "@ext/core/lib/channels.ts";
import {
  disambiguateOpenTabLabels,
  isWalmartOpenTabActive,
  labelWalmartTab,
} from "@ext/domains/walmart/lib/index.ts";
import type {
  ExtensionSettings,
  ExtensionStatus,
  RetailerOpenTabSummary,
  WalmartOpenTabSummary,
} from "@ext/core/types/index.ts";

async function buildWalmartOpenTabs(
  tabs: chrome.tabs.Tab[],
  focusedActiveTabId?: number,
): Promise<WalmartOpenTabSummary[]> {
  const summaries: WalmartOpenTabSummary[] = [];

  for (const tab of tabs) {
    if (tab.id == null || tab.windowId == null) {
      continue;
    }
    const url = tab.url ?? "";
    const title = tab.title ?? "";
    const { label, pageKind } = labelWalmartTab(url, title);
    summaries.push({
      tabId: tab.id,
      windowId: tab.windowId,
      url,
      title,
      label,
      pageKind,
      isActive: isWalmartOpenTabActive(tab.id, focusedActiveTabId),
      isRecording: isWalmartTabRecording(tab.id),
    });
  }

  summaries.sort((a, b) => {
    if (a.windowId !== b.windowId) {
      return a.windowId - b.windowId;
    }
    return a.tabId - b.tabId;
  });

  const disambiguatedLabels = disambiguateOpenTabLabels(summaries);
  for (let i = 0; i < summaries.length; i += 1) {
    summaries[i]!.label = disambiguatedLabels[i]!;
  }

  return summaries;
}

async function buildRetailerOpenTabs(
  tabs: chrome.tabs.Tab[],
  focusedActiveTabId?: number,
): Promise<RetailerOpenTabSummary[]> {
  const summaries: RetailerOpenTabSummary[] = [];

  for (const tab of tabs) {
    if (tab.id == null || tab.windowId == null) {
      continue;
    }
    const url = tab.url ?? "";
    const title = tab.title ?? "";
    const { label, pageKind } = labelRetailerTab(url, title);
    summaries.push({
      tabId: tab.id,
      windowId: tab.windowId,
      url,
      title,
      label,
      pageKind,
      isActive: isRetailerOpenTabActive(tab.id, focusedActiveTabId),
      isRunning: getRetailerTabUiState(tab.id).running,
    });
  }

  summaries.sort((a, b) => {
    if (a.windowId !== b.windowId) {
      return a.windowId - b.windowId;
    }
    return a.tabId - b.tabId;
  });

  const disambiguatedLabels = disambiguateRetailerOpenTabLabels(summaries);
  for (let i = 0; i < summaries.length; i += 1) {
    summaries[i]!.label = disambiguatedLabels[i]!;
  }

  return summaries;
}

const PURCHASE_LIMIT_QUERY_ATTEMPTS = 4;
const PURCHASE_LIMIT_QUERY_RETRY_MS = 150;

function normalizePurchaseLimit(limit: unknown): number | null {
  if (typeof limit === "number" && Number.isFinite(limit) && limit >= 1) {
    return Math.floor(limit);
  }
  return null;
}

async function readRetailerPurchaseLimit(
  tabId: number,
  tabUrl: string,
): Promise<number | null> {
  for (let attempt = 0; attempt < PURCHASE_LIMIT_QUERY_ATTEMPTS; attempt++) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: "RETAILER_GET_PURCHASE_LIMIT",
      })) as { ok?: boolean; purchase_limit?: number | null } | undefined;
      if (response?.ok === true) {
        const limit = normalizePurchaseLimit(response.purchase_limit);
        setRetailerTabPurchaseLimit(tabId, tabUrl, limit);
        return limit;
      }
    } catch {
      // Content script may not be injected yet.
    }

    if (attempt < PURCHASE_LIMIT_QUERY_ATTEMPTS - 1) {
      await sleep(PURCHASE_LIMIT_QUERY_RETRY_MS);
    }
  }
  return null;
}

async function resolveRetailerPurchaseLimit(
  tabId: number,
  tabUrl: string | undefined,
): Promise<number | null> {
  if (!tabUrl) {
    return null;
  }
  const normalizedUrl = normalizeRetailerTabUrl(tabUrl);
  const cached = getRetailerTabPurchaseLimit(tabId, normalizedUrl);
  // Re-query when the cache is missing or still null — early snapshots often run before
  // Target finishes hydrating __NEXT_DATA__ or the qty UI after navigation/refresh.
  if (cached !== undefined && cached !== null) {
    return cached;
  }
  return readRetailerPurchaseLimit(tabId, tabUrl);
}

export async function buildStatus(activeTab?: chrome.tabs.Tab): Promise<ExtensionStatus> {
  const settings = await getSettings();

  let activeChannelId: string | null = null;
  let discordTabDetected = false;

  if (activeTab?.id != null) {
    if (activeTab.url?.startsWith("https://discord.com/channels/")) {
      discordTabDetected = true;
      const fromMap = activeChannels.get(activeTab.id);
      if (fromMap) {
        activeChannelId = fromMap;
      } else if (activeTab.url) {
        try {
          activeChannelId = parseChannelId(new URL(activeTab.url).pathname);
        } catch {
          activeChannelId = null;
        }
      }
    }
  }

  if (!discordTabDetected && activeChannels.size > 0) {
    discordTabDetected = true;
  }

  const activeTabKind = resolveActiveTabKind(activeTab?.url);

  const retailerTabDetected = activeTabKind === "retailer";
  const walmartTabDetected = activeTabKind === "walmart";
  const walmartMetrics = await readMetrics();
  const lastExport = await readLastExport();
  const walmartTabs = await listAllWalmartTabs();
  const walmartOpenTabs = await buildWalmartOpenTabs(walmartTabs, activeTab?.id);
  const retailerTabs = await listAllRetailerTabs();
  const retailerOpenTabs = await buildRetailerOpenTabs(retailerTabs, activeTab?.id);
  const recordingActive =
    walmartMetrics.recordingActive || isAnyWalmartRecording();

  const allowedDomains =
    activeChannelId !== null ? getChannelDomains(settings, activeChannelId) : [];
  const isActive = settings.enabled && activeChannelId !== null;
  const retailerAutoAtcEnabled =
    activeChannelId !== null ? getRetailerAutoAtcEnabled(settings, activeChannelId) : false;
  const retailerRefreshIntervalSec =
    activeChannelId !== null
      ? getRetailerRefreshIntervalSec(settings, activeChannelId)
      : getRetailerRefreshIntervalSec(settings, "manual");

  const tabUi =
    activeTab?.id != null && retailerTabDetected
      ? getRetailerTabUiState(activeTab.id)
      : { status: "", running: false };

  const retailerAtcQuantity = getRetailerAtcQuantity(settings);
  const retailerUseMaxQuantity = getRetailerUseMaxQuantity(settings);
  const retailerPurchaseLimit =
    activeTab?.id != null && retailerTabDetected
      ? await resolveRetailerPurchaseLimit(activeTab.id, activeTab.url)
      : null;
  const quantityStatus = buildQuantityStatusFields(
    retailerAtcQuantity,
    retailerUseMaxQuantity,
    retailerPurchaseLimit,
  );

  const walmartAutoRefresh =
    activeTab?.id != null && walmartTabDetected
      ? getWalmartTabAutoRefresh(activeTab.id)
      : undefined;
  const walmartAutoRefreshEnabled = walmartAutoRefresh?.enabled ?? false;
  const walmartRefreshIntervalSec =
    walmartAutoRefresh?.interval_sec ?? WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC;

  return {
    enabled: settings.enabled,
    active_tab_kind: activeTabKind,
    discord_tab_detected: discordTabDetected,
    retailer_tab_detected: retailerTabDetected,
    any_retailer_tab_open: retailerTabs.length > 0,
    retailer_open_tabs: retailerOpenTabs,
    walmart_tab_detected: walmartTabDetected,
    walmart_recording_active: recordingActive,
    walmart_recording_tab_count: recordingActive ? recordingTabCount() : 0,
    any_walmart_tab_open: walmartTabs.length > 0,
    walmart_recording_event_count: walmartMetrics.eventCount,
    walmart_recording_bytes: walmartMetrics.bytes,
    walmart_recording_drop_date: walmartMetrics.dropDate,
    walmart_last_export_path: lastExport?.filename ?? null,
    walmart_last_export_download_id: lastExport?.downloadId ?? null,
    walmart_open_tabs: walmartOpenTabs,
    active_channel_id: activeChannelId,
    is_active: isActive,
    has_allowed_domains: allowedDomains.length > 0,
    allowed_domains: allowedDomains,
    retailer_auto_atc_enabled: retailerAutoAtcEnabled,
    retailer_refresh_interval_sec: retailerRefreshIntervalSec,
    retailer_frontend_atc_enabled: getRetailerFrontendAtcEnabled(settings),
    retailer_backend_atc_enabled: getRetailerBackendAtcEnabled(settings),
    retailer_manual_status: tabUi.status,
    retailer_manual_running: tabUi.running,
    retailer_atc_quantity: retailerAtcQuantity,
    retailer_use_max_quantity: retailerUseMaxQuantity,
    retailer_purchase_limit: retailerPurchaseLimit,
    retailer_quantity_invalid: quantityStatus.retailer_quantity_invalid,
    retailer_auto_start_blocked: quantityStatus.retailer_auto_start_blocked,
    retailer_auto_checkout_enabled: getRetailerAutoCheckoutEnabled(settings),
    walmart_auto_refresh_enabled: walmartAutoRefreshEnabled,
    walmart_refresh_interval_sec: walmartRefreshIntervalSec,
    open_links_in_window: getOpenLinksInWindow(settings),
    retailer_link_open_count: getRetailerLinkOpenCount(settings),
    sku_open_mode_enabled: getSkuOpenModeEnabled(settings),
  };
}

export async function setRetailerAutoAtcEnabledForChannel(
  channelId: string,
  enabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAutoAtcEnabled(settings, channelId, enabled);
  await saveSettings(next);
  return next;
}

export async function setRetailerRefreshIntervalForChannel(
  channelId: string,
  intervalSec: number,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerRefreshInterval(settings, channelId, intervalSec);
  await saveSettings(next);
  return next;
}

export async function setRetailerAtcModesForSettings(
  frontendEnabled: boolean,
  backendEnabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAtcModes(settings, {
    frontend: frontendEnabled,
    backend: backendEnabled,
  });
  await saveSettings(next);
  return next;
}

export async function setRetailerAtcQuantityForSettings(
  quantity: number,
  useMaxQuantity: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAtcQuantity(settings, { quantity, useMaxQuantity });
  await saveSettings(next);
  return next;
}

export async function setRetailerAutoCheckoutEnabledForSettings(
  enabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAutoCheckoutEnabled(settings, enabled);
  await saveSettings(next);
  return next;
}
