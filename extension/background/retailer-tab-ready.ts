import { sleep } from "@ext/lib/sleep.ts";

const TAB_READY_MAX_MS = 10_000;
const TAB_READY_RETRY_MS = 50;

export async function waitForRetailerTabReady(
  tabId: number,
  maxMs = TAB_READY_MAX_MS,
): Promise<boolean> {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: "RETAILER_PING",
      })) as { ok?: boolean } | undefined;
      if (response?.ok === true) {
        return true;
      }
    } catch {
      // Content script may not be injected yet.
    }
    await sleep(TAB_READY_RETRY_MS);
  }

  return false;
}
