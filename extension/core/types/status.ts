import type { RetailerOpenTabSummary } from "@ext/domains/target/types/retailer.ts";
import type { SamsclubOpenTabSummary } from "@ext/domains/samsclub/types/samsclub.ts";
import type { WalmartOpenTabSummary } from "@ext/domains/walmart/types/walmart.ts";

import type { ActiveTabKind, RetailerAutoCheckoutMode, SamsclubAutoCheckoutMode } from "@ext/core/types/core.ts";

export interface ExtensionStatus {
  enabled: boolean;
  /** Active tab surface for side panel layout. */
  active_tab_kind: ActiveTabKind;
  /** True when any Discord channel tab is connected, not necessarily the active tab. */
  discord_tab_detected: boolean;
  /** Active tab is on target.com (or affiliate redirect to Target). */
  retailer_tab_detected: boolean;
  any_retailer_tab_open: boolean;
  retailer_open_tabs: RetailerOpenTabSummary[];
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
  retailer_auto_checkout_mode: RetailerAutoCheckoutMode;
  walmart_auto_refresh_enabled: boolean;
  walmart_refresh_interval_sec: number;
  walmart_queue_pass_sound_enabled: boolean;
  walmart_consolidate_queue_tabs_enabled: boolean;
  walmart_throttle_refresh_interval_sec: number;
  global_target_positive_keywords: string[];
  global_target_negative_keywords: string[];
  global_walmart_positive_keywords: string[];
  global_walmart_negative_keywords: string[];
  global_target_skus: string[];
  global_walmart_skus: string[];
  /** Global preference: open passive auto-links in a new window (default true). */
  open_links_in_window: boolean;
  /** Target product links from Discord watch open this many times (default 1). */
  retailer_link_open_count: number;
  /** When true, Discord auto-open uses per-channel SKUs instead of link keywords. */
  sku_open_mode_enabled: boolean;
  /** When true, show Walmart research/recording controls in the side panel. */
  walmart_recording_ui_enabled: boolean;
  /** Active tab is on samsclub.com. */
  samsclub_tab_detected: boolean;
  samsclub_recording_active: boolean;
  samsclub_recording_tab_count: number;
  any_samsclub_tab_open: boolean;
  samsclub_recording_event_count: number;
  samsclub_recording_bytes: number;
  samsclub_recording_drop_date: string | null;
  samsclub_last_export_path: string | null;
  samsclub_last_export_download_id: number | null;
  samsclub_open_tabs: SamsclubOpenTabSummary[];
  /** When true, show Sam's Club research/recording controls in the side panel. */
  samsclub_recording_ui_enabled: boolean;
  samsclub_refresh_interval_sec: number;
  samsclub_frontend_atc_enabled: boolean;
  samsclub_backend_atc_enabled: boolean;
  /** Live status from the active Sam's Club tab's automation session. */
  samsclub_manual_status: string;
  samsclub_manual_running: boolean;
  samsclub_atc_quantity: number;
  samsclub_use_max_quantity: boolean;
  samsclub_purchase_limit: number | null;
  samsclub_quantity_invalid: boolean;
  samsclub_auto_start_blocked: boolean;
  samsclub_auto_checkout_mode: SamsclubAutoCheckoutMode;
  /** Saved CVV for Sam's Club checkout autofill; empty when unset. */
  samsclub_checkout_cvv: string;
}
