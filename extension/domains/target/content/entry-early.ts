import { isExtensionContextValid } from "@ext/core/lib/messages.ts";
import { stashPendingStartAuto } from "@ext/domains/target/lib/pending-start-auto.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";

declare global {
  interface Window {
    __cookiescriptsRetailerSessionReady?: boolean;
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundToContent) => {
  if (!isExtensionContextValid()) {
    return;
  }

  if (message.type === "RETAILER_PING") {
    return { ok: true as const };
  }

  if (
    message.type === "RETAILER_START_AUTO" &&
    window.__cookiescriptsRetailerSessionReady !== true
  ) {
    stashPendingStartAuto(message);
    return { ok: true as const };
  }

  return undefined;
});
