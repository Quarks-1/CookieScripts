const SAMSCLUB_TAB_URL_PATTERNS = [
  "https://www.samsclub.com/*",
  "https://samsclub.com/*",
  "https://carts.samsclub.com/*",
] as const;

export async function listAllSamsclubTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ url: [...SAMSCLUB_TAB_URL_PATTERNS] });
}
