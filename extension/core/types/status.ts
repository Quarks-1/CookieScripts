import type { WalmartOpenTabSummary } from "@ext/domains/walmart/types/walmart.ts";

import type { ActiveTabKind } from "@ext/core/types/core.ts";

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
  retailer_auto_checkout_enabled: boolean;
  walmart_auto_refresh_enabled: boolean;
  walmart_refresh_interval_sec: number;
}
