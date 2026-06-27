export const RECENT_URL_LIMIT = 500;
export const HISTORY_LIMIT = 200;
export const MAX_URLS_PER_MESSAGE = 20;
export const RECENT_URLS_DEBOUNCE_MS = 1000;

export const STORAGE_KEYS = {
  settings: "cookiescripts:settings",
  history: "cookiescripts:history",
  recentUrls: "cookiescripts:recentUrls",
} as const;
