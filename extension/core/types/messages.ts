import type {
  EndpointCatalogEntry,
  MarkerLabel,
  PageSnapshotRecord,
  SamsclubRecordingAction,
  SamsclubRecordingEvent,
} from "@ext/domains/samsclub/types/samsclub.ts";
import type {
  EndpointCatalogEntry as WalmartEndpointCatalogEntry,
  MarkerLabel as WalmartMarkerLabel,
  PageSnapshotRecord as WalmartPageSnapshotRecord,
  WalmartRecordingAction,
  WalmartRecordingEvent,
} from "@ext/domains/walmart/types/walmart.ts";

import type {
  ExtensionSettings,
  HistoryItem,
  RetailerAutoCheckoutMode,
  SamsclubAutoCheckoutMode,
} from "@ext/core/types/core.ts";
import type { ExtensionStatus } from "@ext/core/types/status.ts";

export type ContentToBackground =
  | { type: "CHANNEL_ACTIVE"; channel_id: string }
  | { type: "CHANNEL_INACTIVE" }
  | {
      type: "CANDIDATE_LINKS";
      channel_id: string;
      urls: string[];
      author?: string;
      message_text?: string;
      anchors?: { href: string; text: string }[];
    }
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
  | { type: "RETAILER_PURCHASE_LIMIT_SNAPSHOT"; purchase_limit: number | null }
  | { type: "RETAILER_CLOSE_TAB_ON_OOS" };

export type WalmartToBackground =
  | {
      type: "WALMART_RECORDING_APPEND";
      sessionId: string;
      events: WalmartRecordingEvent[];
      pages?: WalmartPageSnapshotRecord[];
      endpoints?: WalmartEndpointCatalogEntry[];
      byteDelta?: number;
      droppedEvents?: number;
      truncated?: boolean;
    }
  | { type: "WALMART_RECORDING_REATTACH"; sessionId: string }
  | { type: "WALMART_PING" }
  | { type: "WALMART_GET_AUTO_REFRESH_CONFIG" }
  | {
      type: "WALMART_SYNC_AUTO_REFRESH";
      enabled: boolean;
      interval_sec: number;
      last_refresh_at?: number;
    }
  | { type: "WALMART_HARD_RELOAD" }
  | {
      type: "WALMART_QUEUE_PASS";
      itemId: string;
      queueId: string;
      productName?: string;
    }
  | {
      type: "WALMART_QUEUE_TAB_CONSOLIDATE_REQUEST";
      trigger: "tickets_pending" | "issue_ticket" | "hold_spot" | "queue_banner";
      homepageTabId?: number;
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
      refresh_interval_sec?: number;
      frontend_atc_enabled?: boolean;
      backend_atc_enabled?: boolean;
      atc_quantity?: number;
      use_max_quantity?: boolean;
      auto_checkout_enabled?: boolean;
    }
  | { type: "RETAILER_STOP_AUTO" }
  | { type: "RETAILER_START_MANUAL_AUTO"; hard_refresh?: boolean }
  | { type: "RETAILER_GET_PURCHASE_LIMIT" }
  | {
      type: "WALMART_RECORDING_START";
      sessionId: string;
      tabId: number;
      joinMode: "primary" | "late";
    }
  | { type: "WALMART_RECORDING_STOP" }
  | { type: "WALMART_RECORDING_MARK"; label: WalmartMarkerLabel }
  | {
      type: "WALMART_AUTO_REFRESH_CONFIG";
      enabled: boolean;
      interval_sec: number;
      pause: boolean;
    }
  | { type: "SAMSCLUB_PING" }
  | {
      type: "SAMSCLUB_START_AUTO";
      channel_id: string;
      url: string;
      source: "discord" | "manual";
      refresh_interval_sec?: number;
      frontend_atc_enabled?: boolean;
      backend_atc_enabled?: boolean;
      atc_quantity?: number;
      use_max_quantity?: boolean;
      auto_checkout_enabled?: boolean;
    }
  | { type: "SAMSCLUB_STOP_AUTO" }
  | { type: "SAMSCLUB_START_MANUAL_AUTO"; hard_refresh?: boolean }
  | { type: "SAMSCLUB_GET_PURCHASE_LIMIT" }
  | {
      type: "SAMSCLUB_RECORDING_START";
      sessionId: string;
      tabId: number;
      joinMode: "primary" | "late";
    }
  | { type: "SAMSCLUB_RECORDING_STOP" }
  | { type: "SAMSCLUB_RECORDING_MARK"; label: MarkerLabel };

export type UiToBackground =
  | { type: "GET_STATUS"; window_id?: number }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: ExtensionSettings }
  | { type: "GET_HISTORY" }
  | { type: "CLEAR_HISTORY" }
  | { type: "GET_DETECTED_DOMAINS"; window_id?: number }
  | { type: "SET_RETAILER_AUTO_ATC_ENABLED"; enabled: boolean }
  | { type: "SET_RETAILER_REFRESH_INTERVAL"; channel_id: string; interval_sec: number }
  | { type: "SET_RETAILER_ATC_MODES"; frontend_enabled: boolean; backend_enabled: boolean }
  | {
      type: "SET_RETAILER_ATC_QUANTITY";
      quantity: number;
      use_max_quantity: boolean;
    }
  | { type: "SET_RETAILER_AUTO_CHECKOUT_MODE"; mode: RetailerAutoCheckoutMode }
  | { type: "RETAILER_START_MANUAL_AUTO"; window_id?: number }
  | { type: "RETAILER_STOP_MANUAL_AUTO"; window_id?: number }
  | {
      type: "WALMART_RECORDING";
      action: WalmartRecordingAction;
      label?: WalmartMarkerLabel;
    }
  | { type: "SET_WALMART_AUTO_REFRESH_ENABLED"; enabled: boolean; window_id?: number }
  | { type: "SET_WALMART_REFRESH_INTERVAL"; interval_sec: number; window_id?: number }
  | {
      type: "SAMSCLUB_RECORDING";
      action: SamsclubRecordingAction;
      label?: MarkerLabel;
    }
  | { type: "SET_SAMSCLUB_REFRESH_INTERVAL"; interval_sec: number }
  | { type: "SET_SAMSCLUB_ATC_MODES"; frontend_enabled: boolean; backend_enabled: boolean }
  | {
      type: "SET_SAMSCLUB_ATC_QUANTITY";
      quantity: number;
      use_max_quantity: boolean;
    }
  | { type: "SET_SAMSCLUB_AUTO_CHECKOUT_MODE"; mode: SamsclubAutoCheckoutMode }
  | { type: "SET_SAMSCLUB_CHECKOUT_CVV"; cvv: string }
  | { type: "SAMSCLUB_START_MANUAL_AUTO"; window_id?: number }
  | { type: "SAMSCLUB_STOP_MANUAL_AUTO"; window_id?: number }
  | {
      type: "SET_RETAILER_SCHEDULE";
      enabled?: boolean;
      start_time?: string;
      end_time?: string;
      stop_on_oos?: boolean;
      close_tab_on_oos?: boolean;
    }
  | {
      type: "SET_SAMSCLUB_SCHEDULE";
      enabled?: boolean;
      start_time?: string;
      end_time?: string;
      stop_on_oos?: boolean;
    };

export type SamsclubToBackground =
  | {
      type: "SAMSCLUB_RECORDING_APPEND";
      sessionId: string;
      events: SamsclubRecordingEvent[];
      pages?: PageSnapshotRecord[];
      endpoints?: EndpointCatalogEntry[];
      byteDelta?: number;
      droppedEvents?: number;
      truncated?: boolean;
    }
  | { type: "SAMSCLUB_RECORDING_REATTACH"; sessionId: string }
  | { type: "SAMSCLUB_PING" }
  | {
      type: "SAMSCLUB_AUTO_STATUS";
      channel_id: string;
      status: "success" | "failed";
      url: string;
      error?: string;
    }
  | { type: "SAMSCLUB_GET_AUTO_CONFIG"; channel_id: string }
  | { type: "SAMSCLUB_SET_REFRESH_INTERVAL"; channel_id: string; interval_sec: number }
  | { type: "SAMSCLUB_HARD_RELOAD" }
  | { type: "SAMSCLUB_GET_TAB_AUTO_STATE" }
  | { type: "SAMSCLUB_SYNC_MANUAL_STOP" }
  | { type: "SAMSCLUB_SYNC_MANUAL_START" }
  | {
      type: "SAMSCLUB_UI_STATE";
      status: string;
      running: boolean;
    }
  | { type: "SAMSCLUB_PURCHASE_LIMIT_SNAPSHOT"; purchase_limit: number | null };

export type RuntimeMessage =
  | ContentToBackground
  | RetailerToBackground
  | WalmartToBackground
  | SamsclubToBackground
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
      auto_checkout_enabled: boolean;
      stop_on_oos_enabled?: boolean;
      close_tab_on_oos_enabled?: boolean;
      checkout_cvv?: string | null;
    }
  | { ok: true; purchase_limit: number | null }
  | { ok: true; manual_auto_stopped: boolean; ui_status: string; ui_running: boolean }
  | { ok: true; export: { downloadId: number; filename: string } }
  | { ok: true; ack: true; dropped?: boolean }
  | { ok: true; tabId: number }
  | { ok: true; enabled: boolean; interval_sec: number; pause: boolean }
  | { ok: true }
  | { ok: false; error: string }
  | WatchConfig;

export type DetectedDomainsResponse =
  | { ok: true; domains: string[] }
  | { ok: false; error: string };
