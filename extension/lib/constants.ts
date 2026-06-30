export const RECENT_URL_LIMIT = 500;
export const HISTORY_LIMIT = 200;
export const MAX_URLS_PER_MESSAGE = 20;
export const RECENT_URLS_DEBOUNCE_MS = 1000;

export const GITHUB_OWNER = "Quarks-1";
export const GITHUB_REPO = "CookieScripts";
export const GITHUB_RELEASES_LATEST_URL =
  `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

export const STORAGE_KEYS = {
  settings: "cookiescripts:settings",
  history: "cookiescripts:history",
  recentUrls: "cookiescripts:recentUrls",
  updateCheck: "cookiescripts:updateCheck",
  ignoredDomains: "cookiescripts:ignoredDomains",
  walmartMetrics: "cookiescripts:walmartMetrics",
  walmartLastExport: "cookiescripts:walmartLastExport",
  walmartMarkedLabels: "cookiescripts:walmartMarkedLabels",
  walmartActiveSession: "cookiescripts:walmartActiveSession",
} as const;
