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

export interface PersistedState {
  settings: ExtensionSettings;
  history: HistoryItem[];
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

export const DEFAULT_SETTINGS: ExtensionSettings = {
  channel_targets: [],
  enabled: true,
};
