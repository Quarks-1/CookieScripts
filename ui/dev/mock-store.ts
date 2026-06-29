import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import { getChannelTarget } from "@ext/lib/channel-targets.ts";
import {
  getRetailerBackendAtcEnabled,
  getRetailerFrontendAtcEnabled,
  getRetailerRefreshIntervalSec,
  setRetailerAtcModes,
  setRetailerAutoEnabled,
  setRetailerRefreshInterval,
} from "@ext/lib/retailer/channel-config.ts";
import { validatePersistedTargets } from "@ext/lib/validate.ts";
import type {
  BackgroundResponse,
  ExtensionSettings,
  ExtensionStatus,
  HistoryItem,
  UiToBackground,
} from "@ext/types/index.ts";
import { DEFAULT_SETTINGS } from "@ext/types/index.ts";

export type PopupScenario =
  | "watching"
  | "active_no_domains"
  | "no_discord"
  | "retailer_auto"
  | "target_manual";

const SAMPLE_CHANNEL_ID = "1234567890123456789";

const SAMPLE_HISTORY: HistoryItem[] = [
  {
    kind: "opened",
    url: "https://www.walmart.com/ip/example",
    author: "dealbot",
    channel_id: SAMPLE_CHANNEL_ID,
    timestamp: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    kind: "duplicate",
    url: "https://www.amazon.com/dp/example",
    author: "shopper",
    channel_id: SAMPLE_CHANNEL_ID,
    timestamp: new Date(Date.now() - 120_000).toISOString(),
  },
];

let settings: ExtensionSettings = {
  enabled: true,
  channel_targets: [
    {
      channel_id: SAMPLE_CHANNEL_ID,
      allowed_domains: ["walmart.com", "amazon.com", "target.com"],
    },
  ],
};

let history: HistoryItem[] = [...SAMPLE_HISTORY];
let popupScenario: PopupScenario = "watching";

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

const storageListeners = new Set<StorageListener>();

export function addStorageChangedListener(listener: StorageListener) {
  storageListeners.add(listener);
}

export function removeStorageChangedListener(listener: StorageListener) {
  storageListeners.delete(listener);
}

function notifyStorage(changes: Record<string, chrome.storage.StorageChange>) {
  for (const listener of storageListeners) {
    listener(changes, "local");
  }
}

function buildStatus(): ExtensionStatus {
  const retailerTabDetected =
    popupScenario === "retailer_auto" || popupScenario === "target_manual";
  const activeTabKind =
    popupScenario === "retailer_auto" || popupScenario === "target_manual"
      ? "retailer"
      : popupScenario === "no_discord"
        ? "other"
        : "discord_channel";
  const allowedDomains =
    popupScenario === "watching" || popupScenario === "retailer_auto"
      ? getChannelTarget(settings, SAMPLE_CHANNEL_ID)?.allowed_domains ?? ["target.com"]
      : [];

  const retailerAutoEnabled =
    popupScenario === "retailer_auto" ||
    getChannelTarget(settings, SAMPLE_CHANNEL_ID)?.retailer_auto_enabled === true;

  const refreshIntervalSec = getRetailerRefreshIntervalSec(settings, SAMPLE_CHANNEL_ID);
  const atcFlags = {
    retailer_frontend_atc_enabled: getRetailerFrontendAtcEnabled(settings),
    retailer_backend_atc_enabled: getRetailerBackendAtcEnabled(settings),
  };

  if (!settings.enabled) {
    return {
      enabled: false,
      active_tab_kind: activeTabKind,
      discord_tab_detected: popupScenario !== "no_discord" && popupScenario !== "target_manual",
      retailer_tab_detected: retailerTabDetected,
      active_channel_id:
        popupScenario === "no_discord" || popupScenario === "target_manual"
          ? null
          : SAMPLE_CHANNEL_ID,
      is_active: false,
      has_allowed_domains: false,
      allowed_domains: [],
      retailer_auto_enabled: false,
      retailer_refresh_interval_sec: 0,
      ...atcFlags,
      retailer_manual_status: "",
      retailer_manual_running: false,
    };
  }

  const manualUi = {
    retailer_manual_status: retailerTabDetected ? "Ready — press Start Auto Mode" : "",
    retailer_manual_running: false,
  };

  switch (popupScenario) {
    case "no_discord":
      return {
        enabled: true,
        active_tab_kind: "other",
        discord_tab_detected: false,
        retailer_tab_detected: false,
        active_channel_id: null,
        is_active: false,
        has_allowed_domains: false,
        allowed_domains: [],
        retailer_auto_enabled: false,
        retailer_refresh_interval_sec: 0,
        ...atcFlags,
        ...manualUi,
      };
    case "target_manual":
      return {
        enabled: true,
        active_tab_kind: "retailer",
        discord_tab_detected: false,
        retailer_tab_detected: true,
        active_channel_id: null,
        is_active: false,
        has_allowed_domains: false,
        allowed_domains: [],
        retailer_auto_enabled: false,
        retailer_refresh_interval_sec: getRetailerRefreshIntervalSec(settings, "manual"),
        ...atcFlags,
        retailer_manual_status: "Ready — open a product page and press Start",
        retailer_manual_running: false,
      };
    case "active_no_domains":
      return {
        enabled: true,
        active_tab_kind: "discord_channel",
        discord_tab_detected: true,
        retailer_tab_detected: false,
        active_channel_id: "999888777666555444",
        is_active: true,
        has_allowed_domains: false,
        allowed_domains: [],
        retailer_auto_enabled: false,
        retailer_refresh_interval_sec: 0,
        ...atcFlags,
        ...manualUi,
      };
    case "retailer_auto":
      return {
        enabled: true,
        active_tab_kind: "retailer",
        discord_tab_detected: true,
        retailer_tab_detected: true,
        active_channel_id: SAMPLE_CHANNEL_ID,
        is_active: true,
        has_allowed_domains: allowedDomains.length > 0,
        allowed_domains: allowedDomains,
        retailer_auto_enabled: retailerAutoEnabled,
        retailer_refresh_interval_sec: refreshIntervalSec,
        ...atcFlags,
        ...manualUi,
      };
    case "watching":
    default:
      return {
        enabled: true,
        active_tab_kind: "discord_channel",
        discord_tab_detected: true,
        retailer_tab_detected: false,
        active_channel_id: SAMPLE_CHANNEL_ID,
        is_active: true,
        has_allowed_domains: allowedDomains.length > 0,
        allowed_domains: allowedDomains,
        retailer_auto_enabled: retailerAutoEnabled,
        retailer_refresh_interval_sec: refreshIntervalSec,
        ...atcFlags,
        ...manualUi,
      };
  }
}

export function handleUiMessage(message: UiToBackground): BackgroundResponse {
  switch (message.type) {
    case "GET_STATUS":
      return { ok: true, status: buildStatus() };
    case "GET_SETTINGS":
      return { ok: true, settings: structuredClone(settings) };
    case "SAVE_SETTINGS": {
      const error = validatePersistedTargets(message.settings.channel_targets);
      if (error) {
        return { ok: false, error };
      }
      settings = structuredClone(message.settings);
      notifyStorage({
        [STORAGE_KEYS.settings]: {
          oldValue: undefined,
          newValue: settings,
        },
      });
      return { ok: true };
    }
    case "SET_RETAILER_AUTO_ENABLED": {
      settings = setRetailerAutoEnabled(settings, message.channel_id, message.enabled);
      notifyStorage({
        [STORAGE_KEYS.settings]: { oldValue: undefined, newValue: settings },
      });
      return { ok: true };
    }
    case "SET_RETAILER_REFRESH_INTERVAL": {
      settings = setRetailerRefreshInterval(
        settings,
        message.channel_id,
        message.interval_sec,
      );
      notifyStorage({
        [STORAGE_KEYS.settings]: { oldValue: undefined, newValue: settings },
      });
      return { ok: true };
    }
    case "SET_RETAILER_ATC_MODES": {
      try {
        settings = setRetailerAtcModes(settings, {
          frontend: message.frontend_enabled,
          backend: message.backend_enabled,
        });
        notifyStorage({
          [STORAGE_KEYS.settings]: { oldValue: undefined, newValue: settings },
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Save failed" };
      }
    }
    case "GET_HISTORY":
      return { ok: true, history: structuredClone(history) };
    case "CLEAR_HISTORY": {
      history = [];
      notifyStorage({
        [STORAGE_KEYS.history]: { oldValue: SAMPLE_HISTORY, newValue: [] },
      });
      return { ok: true };
    }
    case "GET_DETECTED_DOMAINS":
      return { ok: true, domains: ["target.com", "bestbuy.com"] };
    case "RETAILER_START_MANUAL_AUTO":
    case "RETAILER_STOP_MANUAL_AUTO":
      return { ok: true };
  }
}

export function setPopupScenario(scenario: PopupScenario) {
  popupScenario = scenario;
  if (scenario === "retailer_auto") {
    settings = setRetailerAutoEnabled(settings, SAMPLE_CHANNEL_ID, true);
  }
  notifyStorage({
    [STORAGE_KEYS.settings]: { oldValue: settings, newValue: settings },
  });
}

export function getPopupScenario(): PopupScenario {
  return popupScenario;
}

export function resetMockStore() {
  settings = {
    enabled: true,
    channel_targets: [
      {
        channel_id: SAMPLE_CHANNEL_ID,
        allowed_domains: ["walmart.com", "amazon.com", "target.com"],
      },
    ],
  };
  history = [...SAMPLE_HISTORY];
  popupScenario = "watching";
  notifyStorage({
    [STORAGE_KEYS.settings]: { oldValue: undefined, newValue: settings },
    [STORAGE_KEYS.history]: { oldValue: undefined, newValue: history },
  });
}

export function seedEmptySettings() {
  settings = { ...DEFAULT_SETTINGS, channel_targets: [] };
  notifyStorage({
    [STORAGE_KEYS.settings]: { oldValue: undefined, newValue: settings },
  });
}

export function addSampleHistoryItem() {
  history = [
    {
      kind: "opened",
      url: `https://www.walmart.com/ip/dev-${Date.now()}`,
      author: "dev-preview",
      channel_id: SAMPLE_CHANNEL_ID,
      timestamp: new Date().toISOString(),
    },
    ...history,
  ];
  notifyStorage({
    [STORAGE_KEYS.history]: { oldValue: undefined, newValue: history },
  });
}
