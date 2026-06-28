import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import { getChannelTarget } from "@ext/lib/channel-targets.ts";
import {
  getRetailerRefreshIntervalSec,
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

export type PopupScenario = "watching" | "active_no_domains" | "no_discord" | "retailer_auto";

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
  const retailerTabDetected = popupScenario === "retailer_auto";
  const allowedDomains =
    popupScenario === "watching" || popupScenario === "retailer_auto"
      ? getChannelTarget(settings, SAMPLE_CHANNEL_ID)?.allowed_domains ?? ["target.com"]
      : [];

  const retailerAutoEnabled =
    popupScenario === "retailer_auto" ||
    getChannelTarget(settings, SAMPLE_CHANNEL_ID)?.retailer_auto_enabled === true;

  if (!settings.enabled) {
    return {
      enabled: false,
      discord_tab_detected: popupScenario !== "no_discord",
      retailer_tab_detected: retailerTabDetected,
      active_channel_id: popupScenario === "no_discord" ? null : SAMPLE_CHANNEL_ID,
      is_active: false,
      has_allowed_domains: false,
      allowed_domains: [],
      retailer_auto_enabled: false,
      retailer_refresh_interval_sec: 0,
      retailer_manual_status: "",
      retailer_manual_running: false,
    };
  }

  const refreshIntervalSec = getRetailerRefreshIntervalSec(settings, SAMPLE_CHANNEL_ID);
  const manualUi = {
    retailer_manual_status: retailerTabDetected ? "Ready — press Start Auto Mode" : "",
    retailer_manual_running: false,
  };

  switch (popupScenario) {
    case "no_discord":
      return {
        enabled: true,
        discord_tab_detected: false,
        retailer_tab_detected: retailerTabDetected,
        active_channel_id: null,
        is_active: false,
        has_allowed_domains: false,
        allowed_domains: [],
        retailer_auto_enabled: false,
        retailer_refresh_interval_sec: 0,
        ...manualUi,
      };
    case "active_no_domains":
      return {
        enabled: true,
        discord_tab_detected: true,
        retailer_tab_detected: retailerTabDetected,
        active_channel_id: "999888777666555444",
        is_active: true,
        has_allowed_domains: false,
        allowed_domains: [],
        retailer_auto_enabled: false,
        retailer_refresh_interval_sec: 0,
        ...manualUi,
      };
    case "retailer_auto":
    case "watching":
    default:
      return {
        enabled: true,
        discord_tab_detected: true,
        retailer_tab_detected: retailerTabDetected,
        active_channel_id: SAMPLE_CHANNEL_ID,
        is_active: true,
        has_allowed_domains: allowedDomains.length > 0,
        allowed_domains: allowedDomains,
        retailer_auto_enabled: retailerAutoEnabled,
        retailer_refresh_interval_sec: refreshIntervalSec,
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
