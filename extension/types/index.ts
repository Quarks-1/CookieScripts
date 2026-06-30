export type { AutomationStep } from "./retailer.ts";
export type {
  DomButtonSummary,
  ElementDescriptor,
  EndpointCatalogEntry,
  MarkerLabel,
  PageSnapshotRecord,
  WalmartLastExport,
  WalmartOpenTabSummary,
  WalmartPageKind,
  WalmartRecordingAction,
  WalmartRecordingEvent,
  WalmartRecordingMetrics,
  WalmartSessionMeta,
} from "./walmart.ts";
import type { WalmartOpenTabSummary } from "./walmart.ts";

export interface ChannelTarget {
  channel_id: string;
  allowed_domains: string[];
  retailer_auto_atc_enabled?: boolean;
  /** Hard-refresh interval while main add-to-cart is disabled; 0 = off. */
  retailer_refresh_interval_sec?: number;
}

export interface ExtensionSettings {
  channel_targets: ChannelTarget[];
  enabled: boolean;
  /** Used when auto mode runs with channel_id "manual". */
  retailer_refresh_interval_sec?: number;
  /** Default true when undefined — DOM button click add-to-cart. */
  retailer_frontend_atc_enabled?: boolean;
  /** Default false when undefined — cart API POST probe. */
  retailer_backend_atc_enabled?: boolean;
  /** Units to add per ATC attempt; default 1 when omitted. */
  retailer_atc_quantity?: number;
  /** When true, use page purchase_limit instead of retailer_atc_quantity. */
  retailer_use_max_quantity?: boolean;
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

export type ActiveTabKind = "discord_channel" | "retailer" | "walmart" | "other";

export interface ExtensionStatus {
  enabled: boolean;
  /** Active tab surface for side panel layout. */
  active_tab_kind: ActiveTabKind;
  /** True when any Discord channel tab is connected, not necessarily the active tab. */
  discord_tab_detected: boolean;
  /** Active tab is on target.com (or affiliate redirect to Target). */
  retailer_tab_detected: boolean;
  /** Active tab is on walmart.com. */
  walmart_tab_detected: boolean;
  walmart_recording_active: boolean;
  walmart_recording_tab_count: number;
  any_walmart_tab_open: boolean;
  walmart_recording_event_count: number;
  walmart_recording_bytes: number;
  walmart_recording_drop_date: string | null;
  walmart_last_export_path: string | null;
  walmart_last_export_download_id: number | null;
  walmart_open_tabs: WalmartOpenTabSummary[];
  active_channel_id: string | null;
  is_active: boolean;
  has_allowed_domains: boolean;
  allowed_domains: string[];
  retailer_auto_atc_enabled: boolean;
  retailer_refresh_interval_sec: number;
  retailer_frontend_atc_enabled: boolean;
  retailer_backend_atc_enabled: boolean;
  /** Live status from the active Target tab's automation session. */
  retailer_manual_status: string;
  retailer_manual_running: boolean;
  retailer_atc_quantity: number;
  retailer_use_max_quantity: boolean;
  retailer_purchase_limit: number | null;
  retailer_quantity_invalid: boolean;
  retailer_auto_start_blocked: boolean;
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
  | { type: "RETAILER_GET_AUTO_CONFIG"; channel_id: string }
  | { type: "RETAILER_SET_REFRESH_INTERVAL"; channel_id: string; interval_sec: number }
  | { type: "RETAILER_HARD_RELOAD" }
  | { type: "RETAILER_PING" }
  | { type: "RETAILER_GET_TAB_AUTO_STATE" }
  | { type: "RETAILER_SYNC_MANUAL_STOP" }
  | { type: "RETAILER_SYNC_MANUAL_START" }
  | {
      type: "RETAILER_UI_STATE";
      status: string;
      running: boolean;
    }
  | { type: "RETAILER_PURCHASE_LIMIT_SNAPSHOT"; purchase_limit: number | null };

export type WalmartToBackground =
  | {
      type: "WALMART_RECORDING_APPEND";
      sessionId: string;
      events: import("./walmart.ts").WalmartRecordingEvent[];
      pages?: import("./walmart.ts").PageSnapshotRecord[];
      endpoints?: import("./walmart.ts").EndpointCatalogEntry[];
      byteDelta?: number;
      droppedEvents?: number;
      truncated?: boolean;
    }
  | { type: "WALMART_RECORDING_REATTACH"; sessionId: string }
  | { type: "WALMART_PING" };

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
      refresh_interval_sec?: number;
      frontend_atc_enabled?: boolean;
      backend_atc_enabled?: boolean;
      atc_quantity?: number;
      use_max_quantity?: boolean;
    }
  | { type: "RETAILER_STOP_AUTO" }
  | { type: "RETAILER_START_MANUAL_AUTO" }
  | { type: "RETAILER_GET_PURCHASE_LIMIT" }
  | {
      type: "WALMART_RECORDING_START";
      sessionId: string;
      tabId: number;
      joinMode: "primary" | "late";
    }
  | { type: "WALMART_RECORDING_STOP" }
  | { type: "WALMART_RECORDING_MARK"; label: import("./walmart.ts").MarkerLabel };

export type UiToBackground =
  | { type: "GET_STATUS"; window_id?: number }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: ExtensionSettings }
  | { type: "GET_HISTORY" }
  | { type: "CLEAR_HISTORY" }
  | { type: "GET_DETECTED_DOMAINS"; window_id?: number }
  | { type: "SET_RETAILER_AUTO_ATC_ENABLED"; channel_id: string; enabled: boolean }
  | { type: "SET_RETAILER_REFRESH_INTERVAL"; channel_id: string; interval_sec: number }
  | { type: "SET_RETAILER_ATC_MODES"; frontend_enabled: boolean; backend_enabled: boolean }
  | {
      type: "SET_RETAILER_ATC_QUANTITY";
      quantity: number;
      use_max_quantity: boolean;
    }
  | { type: "RETAILER_START_MANUAL_AUTO"; window_id?: number }
  | { type: "RETAILER_STOP_MANUAL_AUTO"; window_id?: number }
  | {
      type: "WALMART_RECORDING";
      action: import("./walmart.ts").WalmartRecordingAction;
      label?: import("./walmart.ts").MarkerLabel;
    };

export type RuntimeMessage =
  | ContentToBackground
  | RetailerToBackground
  | WalmartToBackground
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
  | {
      ok: true;
      refresh_interval_sec: number;
      frontend_atc_enabled: boolean;
      backend_atc_enabled: boolean;
      atc_quantity: number;
      use_max_quantity: boolean;
    }
  | { ok: true; purchase_limit: number | null }
  | { ok: true; manual_auto_stopped: boolean; ui_status: string; ui_running: boolean }
  | { ok: true; export: { downloadId: number; filename: string } }
  | { ok: true; ack: true; dropped?: boolean }
  | { ok: true; tabId: number }
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
