import {
  getChannelDomains,
  getGlobalKeywords,
  getGlobalWatchSkus,
} from "@ext/core/lib/channel-targets.ts";
import {
  getRetailerAtcQuantity,
  getRetailerAutoAtcEnabled,
  getRetailerAutoCheckoutMode,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerLinkOpenCount,
  getRetailerRefreshIntervalSec,
  getRetailerUseMaxQuantity,
  setRetailerAtcModes,
  setRetailerAtcQuantity,
  setRetailerAutoAtcEnabled,
  setRetailerAutoCheckoutMode,
  setRetailerRefreshInterval,
} from "@ext/domains/target/lib/channel-config.ts";
import { buildQuantityStatusFields as buildRetailerQuantityStatusFields } from "@ext/domains/target/lib/quantity-limit.ts";
import {
  getSamsclubAtcQuantity,
  getSamsclubAutoCheckoutMode,
  getSamsclubBackendAtcEnabled,
  getSamsclubCheckoutCvv,
  getSamsclubFrontendAtcEnabled,
  getSamsclubRefreshIntervalSec,
  getSamsclubUseMaxQuantity,
  setSamsclubAtcModes,
  setSamsclubAtcQuantity,
  setSamsclubAutoCheckoutMode,
  setSamsclubCheckoutCvv,
  setSamsclubRefreshInterval,
  buildQuantityStatusFields as buildSamsclubQuantityStatusFields,
} from "@ext/domains/samsclub/lib/index.ts";
import { sleep } from "@ext/core/lib/sleep.ts";
import { getScheduleActionStatus } from "@ext/core/background/schedule-runtime-state.ts";
import { readScheduleSession } from "@ext/core/lib/schedule-session.ts";
import {
  getSchedulePhase,
  schedulePhaseStatusLine,
  type SchedulePhase,
} from "@ext/core/lib/schedule.ts";
import {
  getRetailerCloseTabOnOos,
  getRetailerScheduleEnabled,
  getRetailerScheduleEndTime,
  getRetailerScheduleStartTime,
  getRetailerScheduleStopOnOos,
  getSamsclubScheduleEnabled,
  getSamsclubScheduleEndTime,
  getSamsclubScheduleStartTime,
  getSamsclubScheduleStopOnOos,
} from "@ext/core/lib/schedule-settings.ts";
import { resolveActiveTabKind } from "@ext/core/lib/active-tab.ts";
import {
  getOpenLinksInWindow,
  getSamsclubRecordingUiEnabled,
  getSkuOpenModeEnabled,
  getWalmartRecordingUiEnabled,
} from "@ext/core/lib/watch.ts";
import type { RetailerAutoCheckoutMode, SamsclubAutoCheckoutMode } from "@ext/core/types/index.ts";
import { getSettings, saveSettings } from "@ext/core/lib/storage.ts";
import { activeChannels } from "@ext/core/background/runtime-state.ts";
import { listAllRetailerTabs } from "@ext/domains/target/background/tabs.ts";
import {
  getSamsclubTabPurchaseLimit,
  getSamsclubTabUiState,
  normalizeSamsclubTabUrl,
  setSamsclubTabPurchaseLimit,
} from "@ext/domains/samsclub/background/automation-runtime-state.ts";
import { listAllSamsclubTabs } from "@ext/domains/samsclub/background/tabs.ts";
import {
  isAnySamsclubRecording,
  isSamsclubTabRecording,
  readLastExport as readSamsclubLastExport,
  readMetrics as readSamsclubMetrics,
  recordingTabCount as samsclubRecordingTabCount,
} from "@ext/domains/samsclub/background/runtime-state.ts";
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
import {
  normalizeWalmartRefreshIntervalSec,
  WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
} from "@ext/domains/walmart/lib/index.ts";
import { listAllWalmartTabs } from "@ext/domains/walmart/background/tabs.ts";
import { parseChannelId } from "@ext/core/lib/channels.ts";
import {
  disambiguateOpenTabLabels as disambiguateSamsclubOpenTabLabels,
  isSamsclubOpenTabActive,
  labelSamsclubTab,
} from "@ext/domains/samsclub/lib/index.ts";
import {
  disambiguateOpenTabLabels as disambiguateWalmartOpenTabLabels,
  isWalmartOpenTabActive,
  labelWalmartTab,
} from "@ext/domains/walmart/lib/index.ts";
import type {
  ExtensionSettings,
  ExtensionStatus,
  RetailerOpenTabSummary,
  SamsclubOpenTabSummary,
  WalmartOpenTabSummary,
} from "@ext/core/types/index.ts";

async function buildSamsclubOpenTabs(
  tabs: chrome.tabs.Tab[],
  focusedActiveTabId?: number,
): Promise<SamsclubOpenTabSummary[]> {
  const summaries: SamsclubOpenTabSummary[] = [];

  for (const tab of tabs) {
    if (tab.id == null || tab.windowId == null) {
      continue;
    }
    const url = tab.url ?? "";
    const title = tab.title ?? "";
    const { label, pageKind } = labelSamsclubTab(url, title);
    summaries.push({
      tabId: tab.id,
      windowId: tab.windowId,
      url,
      title,
      label,
      pageKind,
      isActive: isSamsclubOpenTabActive(tab.id, focusedActiveTabId),
      isRecording: isSamsclubTabRecording(tab.id),
    });
  }

  summaries.sort((a, b) => {
    if (a.windowId !== b.windowId) {
      return a.windowId - b.windowId;
    }
    return a.tabId - b.tabId;
  });

  const disambiguatedLabels = disambiguateSamsclubOpenTabLabels(summaries);
  for (let i = 0; i < summaries.length; i += 1) {
    summaries[i]!.label = disambiguatedLabels[i]!;
  }

  return summaries;
}

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

  const disambiguatedLabels = disambiguateWalmartOpenTabLabels(summaries);
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

async function readSamsclubPurchaseLimit(
  tabId: number,
  tabUrl: string,
): Promise<number | null> {
  for (let attempt = 0; attempt < PURCHASE_LIMIT_QUERY_ATTEMPTS; attempt++) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: "SAMSCLUB_GET_PURCHASE_LIMIT",
      })) as { ok?: boolean; purchase_limit?: number | null } | undefined;
      if (response?.ok === true) {
        const limit = normalizePurchaseLimit(response.purchase_limit);
        setSamsclubTabPurchaseLimit(tabId, tabUrl, limit);
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

async function resolveSamsclubPurchaseLimit(
  tabId: number,
  tabUrl: string | undefined,
): Promise<number | null> {
  if (!tabUrl) {
    return null;
  }
  const normalizedUrl = normalizeSamsclubTabUrl(tabUrl);
  const cached = getSamsclubTabPurchaseLimit(tabId, normalizedUrl);
  if (cached !== undefined && cached !== null) {
    return cached;
  }
  return readSamsclubPurchaseLimit(tabId, tabUrl);
}

async function buildRetailerScheduleStatus(
  settings: ExtensionSettings,
): Promise<{
  retailer_schedule_enabled: boolean;
  retailer_schedule_start_time: string | null;
  retailer_schedule_end_time: string | null;
  retailer_schedule_stop_on_oos: boolean;
  retailer_close_tab_on_oos: boolean;
  retailer_schedule_phase: SchedulePhase;
  retailer_schedule_status: string;
}> {
  const enabled = getRetailerScheduleEnabled(settings);
  const startTime = getRetailerScheduleStartTime(settings);
  const endTime = getRetailerScheduleEndTime(settings);
  const session = await readScheduleSession("target");
  const now = new Date();
  const phase = getSchedulePhase(
    enabled,
    startTime ?? undefined,
    endTime ?? undefined,
    now,
    session.start_fired_date,
    session.end_fired_date,
  );
  return {
    retailer_schedule_enabled: enabled,
    retailer_schedule_start_time: startTime,
    retailer_schedule_end_time: endTime,
    retailer_schedule_stop_on_oos: getRetailerScheduleStopOnOos(settings),
    retailer_close_tab_on_oos: getRetailerCloseTabOnOos(settings),
    retailer_schedule_phase: phase,
    retailer_schedule_status: schedulePhaseStatusLine(
      phase,
      startTime,
      now,
      getScheduleActionStatus("target"),
      endTime,
      session.start_fired_date,
    ),
  };
}

async function buildSamsclubScheduleStatus(
  settings: ExtensionSettings,
): Promise<{
  samsclub_schedule_enabled: boolean;
  samsclub_schedule_start_time: string | null;
  samsclub_schedule_end_time: string | null;
  samsclub_schedule_stop_on_oos: boolean;
  samsclub_schedule_phase: SchedulePhase;
  samsclub_schedule_status: string;
}> {
  const enabled = getSamsclubScheduleEnabled(settings);
  const startTime = getSamsclubScheduleStartTime(settings);
  const endTime = getSamsclubScheduleEndTime(settings);
  const session = await readScheduleSession("samsclub");
  const now = new Date();
  const phase = getSchedulePhase(
    enabled,
    startTime ?? undefined,
    endTime ?? undefined,
    now,
    session.start_fired_date,
    session.end_fired_date,
  );
  return {
    samsclub_schedule_enabled: enabled,
    samsclub_schedule_start_time: startTime,
    samsclub_schedule_end_time: endTime,
    samsclub_schedule_stop_on_oos: getSamsclubScheduleStopOnOos(settings),
    samsclub_schedule_phase: phase,
    samsclub_schedule_status: schedulePhaseStatusLine(
      phase,
      startTime,
      now,
      getScheduleActionStatus("samsclub"),
      endTime,
      session.start_fired_date,
    ),
  };
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
  const samsclubTabDetected = activeTabKind === "samsclub";
  const walmartMetrics = await readMetrics();
  const lastExport = await readLastExport();
  const samsclubMetrics = await readSamsclubMetrics();
  const samsclubLastExport = await readSamsclubLastExport();
  const walmartTabs = await listAllWalmartTabs();
  const walmartOpenTabs = await buildWalmartOpenTabs(walmartTabs, activeTab?.id);
  const samsclubTabs = await listAllSamsclubTabs();
  const samsclubOpenTabs = await buildSamsclubOpenTabs(samsclubTabs, activeTab?.id);
  const retailerTabs = await listAllRetailerTabs();
  const retailerOpenTabs = await buildRetailerOpenTabs(retailerTabs, activeTab?.id);
  const recordingActive =
    walmartMetrics.recordingActive || isAnyWalmartRecording();
  const samsclubRecordingActive =
    samsclubMetrics.recordingActive || isAnySamsclubRecording();

  const allowedDomains =
    activeChannelId !== null ? getChannelDomains(settings, activeChannelId) : [];
  const isActive = settings.enabled && activeChannelId !== null;
  const retailerAutoAtcEnabled = getRetailerAutoAtcEnabled(settings);
  const retailerRefreshIntervalSec =
    activeChannelId !== null
      ? getRetailerRefreshIntervalSec(settings, activeChannelId)
      : getRetailerRefreshIntervalSec(settings, "manual");

  const tabUi =
    activeTab?.id != null && retailerTabDetected
      ? getRetailerTabUiState(activeTab.id)
      : { status: "", running: false };

  const samsclubTabUi =
    activeTab?.id != null && samsclubTabDetected
      ? getSamsclubTabUiState(activeTab.id)
      : { status: "", running: false };

  const retailerAtcQuantity = getRetailerAtcQuantity(settings);
  const retailerUseMaxQuantity = getRetailerUseMaxQuantity(settings);
  const retailerPurchaseLimit =
    activeTab?.id != null && retailerTabDetected
      ? await resolveRetailerPurchaseLimit(activeTab.id, activeTab.url)
      : null;
  const quantityStatus = buildRetailerQuantityStatusFields(
    retailerAtcQuantity,
    retailerUseMaxQuantity,
    retailerPurchaseLimit,
  );

  const samsclubAtcQuantity = getSamsclubAtcQuantity(settings);
  const samsclubUseMaxQuantity = getSamsclubUseMaxQuantity(settings);
  const samsclubPurchaseLimit =
    activeTab?.id != null && samsclubTabDetected
      ? await resolveSamsclubPurchaseLimit(activeTab.id, activeTab.url)
      : null;
  const samsclubQuantityStatus = buildSamsclubQuantityStatusFields(
    samsclubAtcQuantity,
    samsclubUseMaxQuantity,
    samsclubPurchaseLimit,
  );

  const walmartAutoRefresh =
    activeTab?.id != null && walmartTabDetected
      ? getWalmartTabAutoRefresh(activeTab.id)
      : undefined;
  const walmartAutoRefreshEnabled = walmartAutoRefresh?.enabled ?? false;
  const walmartRefreshIntervalSec =
    walmartAutoRefresh?.interval_sec ?? WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC;

  const retailerScheduleStatus = await buildRetailerScheduleStatus(settings);
  const samsclubScheduleStatus = await buildSamsclubScheduleStatus(settings);

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
    samsclub_tab_detected: samsclubTabDetected,
    samsclub_recording_active: samsclubRecordingActive,
    samsclub_recording_tab_count: samsclubRecordingActive ? samsclubRecordingTabCount() : 0,
    any_samsclub_tab_open: samsclubTabs.length > 0,
    samsclub_recording_event_count: samsclubMetrics.eventCount,
    samsclub_recording_bytes: samsclubMetrics.bytes,
    samsclub_recording_drop_date: samsclubMetrics.dropDate,
    samsclub_last_export_path: samsclubLastExport?.filename ?? null,
    samsclub_last_export_download_id: samsclubLastExport?.downloadId ?? null,
    samsclub_open_tabs: samsclubOpenTabs,
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
    retailer_auto_checkout_mode: getRetailerAutoCheckoutMode(settings),
    ...retailerScheduleStatus,
    walmart_auto_refresh_enabled: walmartAutoRefreshEnabled,
    walmart_refresh_interval_sec: walmartRefreshIntervalSec,
    walmart_queue_pass_sound_enabled: settings.walmart_queue_pass_sound_enabled !== false,
    walmart_consolidate_queue_tabs_enabled:
      settings.walmart_consolidate_queue_tabs_enabled !== false,
    walmart_throttle_refresh_interval_sec: normalizeWalmartRefreshIntervalSec(
      settings.walmart_throttle_refresh_interval_sec ?? WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
    ),
    global_target_positive_keywords: getGlobalKeywords(settings, "target").positive,
    global_target_negative_keywords: getGlobalKeywords(settings, "target").negative,
    global_walmart_positive_keywords: getGlobalKeywords(settings, "walmart").positive,
    global_walmart_negative_keywords: getGlobalKeywords(settings, "walmart").negative,
    global_target_skus: getGlobalWatchSkus(settings, "target"),
    global_walmart_skus: getGlobalWatchSkus(settings, "walmart"),
    open_links_in_window: getOpenLinksInWindow(settings),
    retailer_link_open_count: getRetailerLinkOpenCount(settings),
    sku_open_mode_enabled: getSkuOpenModeEnabled(settings),
    walmart_recording_ui_enabled: getWalmartRecordingUiEnabled(settings),
    samsclub_recording_ui_enabled: getSamsclubRecordingUiEnabled(settings),
    samsclub_refresh_interval_sec: getSamsclubRefreshIntervalSec(settings),
    samsclub_frontend_atc_enabled: getSamsclubFrontendAtcEnabled(settings),
    samsclub_backend_atc_enabled: getSamsclubBackendAtcEnabled(settings),
    samsclub_manual_status: samsclubTabUi.status,
    samsclub_manual_running: samsclubTabUi.running,
    samsclub_atc_quantity: samsclubAtcQuantity,
    samsclub_use_max_quantity: samsclubUseMaxQuantity,
    samsclub_purchase_limit: samsclubPurchaseLimit,
    samsclub_quantity_invalid: samsclubQuantityStatus.samsclub_quantity_invalid,
    samsclub_auto_start_blocked: samsclubQuantityStatus.samsclub_auto_start_blocked,
    samsclub_auto_checkout_mode: getSamsclubAutoCheckoutMode(settings),
    samsclub_checkout_cvv: getSamsclubCheckoutCvv(settings) ?? "",
    ...samsclubScheduleStatus,
  };
}

export async function setRetailerAutoAtcEnabledGlobal(
  enabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAutoAtcEnabled(settings, enabled);
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

export async function setRetailerAutoCheckoutModeForSettings(
  mode: RetailerAutoCheckoutMode,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAutoCheckoutMode(settings, mode);
  await saveSettings(next);
  return next;
}

export async function setSamsclubRefreshIntervalGlobal(
  intervalSec: number,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setSamsclubRefreshInterval(settings, intervalSec);
  await saveSettings(next);
  return next;
}

/** Global-only refresh interval; channel id is ignored for Sam's Club. */
export async function setSamsclubRefreshIntervalForChannel(
  _channelId: string,
  intervalSec: number,
): Promise<ExtensionSettings> {
  return setSamsclubRefreshIntervalGlobal(intervalSec);
}

export async function setSamsclubAtcModesForSettings(
  frontendEnabled: boolean,
  backendEnabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setSamsclubAtcModes(settings, {
    frontend: frontendEnabled,
    backend: backendEnabled,
  });
  await saveSettings(next);
  return next;
}

export async function setSamsclubAtcQuantityForSettings(
  quantity: number,
  useMaxQuantity: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setSamsclubAtcQuantity(settings, { quantity, useMaxQuantity });
  await saveSettings(next);
  return next;
}

export async function setSamsclubAutoCheckoutModeForSettings(
  mode: SamsclubAutoCheckoutMode,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setSamsclubAutoCheckoutMode(settings, mode);
  await saveSettings(next);
  return next;
}

export async function setSamsclubCheckoutCvvForSettings(
  cvv: string,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setSamsclubCheckoutCvv(settings, cvv);
  await saveSettings(next);
  return next;
}
