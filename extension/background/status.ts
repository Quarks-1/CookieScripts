import { getChannelDomains } from "@ext/lib/channel-targets.ts";
import {
  getRetailerAutoEnabled,
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerRefreshIntervalSec,
  setRetailerAtcModes,
  setRetailerAutoEnabled,
  setRetailerRefreshInterval,
} from "@ext/lib/retailer/channel-config.ts";
import { resolveActiveTabKind } from "@ext/lib/active-tab.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import { getSettings, saveSettings } from "@ext/lib/storage.ts";
import { activeChannels } from "@ext/background/runtime-state.ts";
import { getRetailerTabUiState } from "@ext/background/retailer-runtime-state.ts";
import {
  isAnyWalmartRecording,
  isWalmartTabRecording,
  readLastExport,
  readMetrics,
  recordingTabCount,
} from "@ext/background/walmart-runtime-state.ts";
import { listAllWalmartTabs } from "@ext/background/walmart-tabs.ts";
import { parseChannelId } from "@ext/lib/channels.ts";
import { isWalmartOpenTabActive } from "@ext/lib/walmart/open-tab-active.ts";
import { disambiguateOpenTabLabels, labelWalmartTab } from "@ext/lib/walmart/tab-label.ts";
import type { ExtensionSettings, ExtensionStatus } from "@ext/types/index.ts";
import type { WalmartOpenTabSummary } from "@ext/types/walmart.ts";

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
  const recordingActive =
    walmartMetrics.recordingActive || isAnyWalmartRecording();

  const allowedDomains =
    activeChannelId !== null ? getChannelDomains(settings, activeChannelId) : [];
  const isActive = settings.enabled && activeChannelId !== null;
  const retailerAutoEnabled =
    activeChannelId !== null ? getRetailerAutoEnabled(settings, activeChannelId) : false;
  const retailerRefreshIntervalSec =
    activeChannelId !== null
      ? getRetailerRefreshIntervalSec(settings, activeChannelId)
      : getRetailerRefreshIntervalSec(settings, "manual");

  const tabUi =
    activeTab?.id != null && retailerTabDetected
      ? getRetailerTabUiState(activeTab.id)
      : { status: "", running: false };

  return {
    enabled: settings.enabled,
    active_tab_kind: activeTabKind,
    discord_tab_detected: discordTabDetected,
    retailer_tab_detected: retailerTabDetected,
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
    retailer_auto_enabled: retailerAutoEnabled && allowlistIncludesRetailerHost(allowedDomains),
    retailer_refresh_interval_sec: retailerRefreshIntervalSec,
    retailer_frontend_atc_enabled: getRetailerFrontendAtcEnabled(settings),
    retailer_backend_atc_enabled: getRetailerBackendAtcEnabled(settings),
    retailer_manual_status: tabUi.status,
    retailer_manual_running: tabUi.running,
  };
}

export async function setRetailerAutoEnabledForChannel(
  channelId: string,
  enabled: boolean,
): Promise<ExtensionSettings> {
  const settings = await getSettings();
  const next = setRetailerAutoEnabled(settings, channelId, enabled);
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
