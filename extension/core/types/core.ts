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
  /** When true, continue through signed-in checkout to order confirmation. */
  retailer_auto_checkout_enabled?: boolean;
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

export const DEFAULT_SETTINGS: ExtensionSettings = {
  channel_targets: [],
  enabled: true,
};
