export interface ChannelTarget {
  channel_id: string;
  allowed_domains: string[];
}

export interface ExtensionSettings {
  channel_targets: ChannelTarget[];
  enabled: boolean;
}

export interface HistoryItem {
  kind: "opened" | "duplicate";
  url: string;
  author: string;
  channel_id: string;
  timestamp: string;
}

/** Documentation shape — persisted as separate storage keys, not one blob load. */
export interface PersistedState {
  settings: ExtensionSettings;
  history: HistoryItem[];
  recentUrls: string[];
}

export interface ExtensionStatus {
  enabled: boolean;
  discord_tab_detected: boolean;
  active_channel_id: string | null;
  is_active: boolean;
  has_allowed_domains: boolean;
  allowed_domains: string[];
}

export type ContentToBackground =
  | { type: "CHANNEL_ACTIVE"; channel_id: string }
  | { type: "CHANNEL_INACTIVE" }
  | { type: "CANDIDATE_LINKS"; channel_id: string; urls: string[]; author?: string };

export type BackgroundToContent =
  | { type: "WATCH_CONFIG"; channel_id: string | null; allowed_domains: string[] }
  | { type: "PING" };

export type UiToBackground =
  | { type: "GET_STATUS" }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: ExtensionSettings }
  | { type: "GET_HISTORY" }
  | { type: "CLEAR_HISTORY" };

export type RuntimeMessage = ContentToBackground | BackgroundToContent | UiToBackground;

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
  | { ok: true }
  | { ok: false; error: string }
  | WatchConfig;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  channel_targets: [],
  enabled: true,
};
