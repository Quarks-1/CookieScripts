export type RetailerAutoCheckoutMode = "off" | "sku_only" | "all";

export interface ChannelTarget {
  channel_id: string;
  allowed_domains: string[];
  /** Hard-refresh interval while main add-to-cart is disabled; 0 = off. */
  retailer_refresh_interval_sec?: number;
}

export interface ExtensionSettings {
  channel_targets: ChannelTarget[];
  enabled: boolean;
  /** Global per-retailer keyword lists for Discord link gating. */
  watch_keywords?: {
    target?: { positive?: string[]; negative?: string[] };
    walmart?: { positive?: string[]; negative?: string[] };
  };
  /** Global per-retailer SKU watch lists for SKU open mode. */
  watch_skus?: {
    target?: string[];
    walmart?: string[];
  };
  /** When true, Discord-initiated Target links start auto ATC. */
  retailer_auto_atc_enabled?: boolean;
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
  /** Auto checkout scope after ATC: off, SKU-match Discord opens only, or all opens. */
  retailer_auto_checkout_mode?: RetailerAutoCheckoutMode;
  /**
   * @deprecated Read for migration only — use `retailer_auto_checkout_mode`.
   * `true` maps to `"all"` when mode is omitted.
   */
  retailer_auto_checkout_enabled?: boolean;
  /** Default true when undefined — play beep on Walmart queue pass. */
  walmart_queue_pass_sound_enabled?: boolean;
  /** Default true when undefined — close duplicate /qp tabs during queue. */
  walmart_consolidate_queue_tabs_enabled?: boolean;
  /** Global throttle-page hard-refresh interval; default 10 when omitted. */
  walmart_throttle_refresh_interval_sec?: number;
  /** Default true when undefined — open passive auto-links in a new window. */
  open_links_in_window?: boolean;
  /** Target product links from Discord watch open this many times; default 1. */
  retailer_link_open_count?: number;
  /** When true, Discord auto-open uses global SKUs instead of link keywords. */
  sku_open_mode_enabled?: boolean;
  /** When true, show Walmart research/recording controls in the side panel. */
  walmart_recording_ui_enabled?: boolean;
}

export type HistoryItemKind =
  | "opened"
  | "duplicate"
  | "keyword_skipped"
  | "sku_skipped"
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

export const DEFAULT_SETTINGS: ExtensionSettings = {
  channel_targets: [],
  enabled: true,
};
