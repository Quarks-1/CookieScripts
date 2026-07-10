const RETAILER_TAB_URL_PATTERNS = [
  "https://www.target.com/*",
  "https://target.com/*",
  "https://carts.target.com/*",
] as const;

export async function listAllRetailerTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ url: [...RETAILER_TAB_URL_PATTERNS] });
}
