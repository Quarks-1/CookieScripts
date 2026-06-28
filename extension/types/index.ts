import type { RetailerProfile } from "./retailer.ts";

export type { AutomationStep, ElementDescriptor, RetailerProfile } from "./retailer.ts";

export interface ChannelTarget {
  channel_id: string;
  allowed_domains: string[];
  retailer_auto_enabled?: boolean;
  /** Hard-refresh interval while main add-to-cart is disabled; 0 = off. */
  retailer_refresh_interval_sec?: number;
}

export interface ExtensionSettings {
  channel_targets: ChannelTarget[];
  enabled: boolean;
  /** Used when auto mode runs with channel_id "manual". */
  retailer_refresh_interval_sec?: number;
}

export type HistoryItemKind =
  | "opened"
  | "duplicate"
  | "retailer_window_opened"
  | "retailer_auto_queued"
  | "retailer_auto_success"
  | "retailer_auto_failed";

export interface HistoryItem {
  kind: HistoryItemKind;
  url: string;
  author: string;
  channel_id: string;
  timestamp: string;
  error?: string;
}

export interface ExtensionStatus {
  enabled: boolean;
  discord_tab_detected: boolean;
  /** Active tab is on target.com (or affiliate redirect to Target). */
  retailer_tab_detected: boolean;
  active_channel_id: string | null;
  is_active: boolean;
  has_allowed_domains: boolean;
  allowed_domains: string[];
  retailer_auto_enabled: boolean;
  retailer_steps_recorded: number;
  retailer_refresh_interval_sec: number;
  /** Live status from the active Target tab's automation session. */
  retailer_manual_status: string;
  retailer_manual_running: boolean;
  retailer_recording: boolean;
}

export type ContentToBackground =
  | { type: "CHANNEL_ACTIVE"; channel_id: string }
  | { type: "CHANNEL_INACTIVE" }
  | { type: "CANDIDATE_LINKS"; channel_id: string; urls: string[]; author?: string }
  | { type: "ADD_ALLOWED_DOMAIN"; channel_id: string; domain: string }
  | { type: "IGNORE_DOMAIN"; channel_id: string; domain: string };

export type RetailerToBackground =
  | {
      type: "RETAILER_AUTO_STATUS";
      channel_id: string;
      status: "success" | "failed";
      url: string;
      error?: string;
    }
  | { type: "RETAILER_RECORDING_SAVE"; profile: RetailerProfile }
  | { type: "RETAILER_RECORDING_GET" }
  | { type: "RETAILER_GET_AUTO_CONFIG"; channel_id: string }
  | { type: "RETAILER_SET_REFRESH_INTERVAL"; channel_id: string; interval_sec: number }
  | { type: "RETAILER_HARD_RELOAD" }
  | { type: "RETAILER_PING" }
  | {
      type: "RETAILER_UI_STATE";
      status: string;
      running: boolean;
      recording: boolean;
    };

export type BackgroundToContent =
  | { type: "WATCH_CONFIG"; channel_id: string | null; allowed_domains: string[] }
  | { type: "PING" }
  | { type: "SCAN_DETECTED_DOMAINS" }
  | { type: "RETAILER_PING" }
  | {
      type: "RETAILER_START_AUTO";
      channel_id: string;
      url: string;
      source: "discord" | "manual";
    }
  | { type: "RETAILER_STOP_AUTO" }
  | { type: "RETAILER_START_MANUAL_AUTO" }
  | { type: "RETAILER_TOGGLE_RECORDING" }
  | { type: "RETAILER_SAVE_RECORDING" };

export type UiToBackground =
  | { type: "GET_STATUS" }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: ExtensionSettings }
  | { type: "GET_HISTORY" }
  | { type: "CLEAR_HISTORY" }
  | { type: "GET_DETECTED_DOMAINS" }
  | { type: "SET_RETAILER_AUTO_ENABLED"; channel_id: string; enabled: boolean }
  | { type: "SET_RETAILER_REFRESH_INTERVAL"; channel_id: string; interval_sec: number }
  | { type: "CLEAR_RETAILER_PROFILE" }
  | { type: "RETAILER_START_MANUAL_AUTO" }
  | { type: "RETAILER_STOP_MANUAL_AUTO" }
  | { type: "RETAILER_TOGGLE_RECORDING" }
  | { type: "RETAILER_SAVE_RECORDING" };

export type RuntimeMessage =
  | ContentToBackground
  | RetailerToBackground
  | BackgroundToContent
  | UiToBackground;

export type WatchConfig = {
  type: "WATCH_CONFIG";
  channel_id: string | null;
  allowed_domains: string[];
};

export type BackgroundResponse =
  | { ok: true; status: ExtensionStatus }
  | { ok: true; settings: ExtensionSettings }
  | { ok: true; history: HistoryItem[] }
  | { ok: true; opened: string[]; duplicates: string[] }
  | { ok: true; domains: string[] }
  | { ok: true; profile: RetailerProfile | null }
  | { ok: true; refresh_interval_sec: number }
  | { ok: true }
  | { ok: false; error: string }
  | WatchConfig;

export type DetectedDomainsResponse =
  | { ok: true; domains: string[] }
  | { ok: false; error: string };

export const DEFAULT_SETTINGS: ExtensionSettings = {
  channel_targets: [],
  enabled: true,
};
