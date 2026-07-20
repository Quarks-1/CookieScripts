import { isExtensionContextValid } from "@ext/core/lib/messages.ts";
import { stashPendingStartAuto } from "@ext/domains/samsclub/lib/pending-start-auto.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";

declare global {
  interface Window {
    __cookiescriptsSamsclubSessionReady?: boolean;
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundToContent) => {
  if (!isExtensionContextValid()) {
    return;
  }

  if (message.type === "SAMSCLUB_PING") {
    return { ok: true as const };
  }

  if (
    message.type === "SAMSCLUB_START_AUTO" &&
    window.__cookiescriptsSamsclubSessionReady !== true
  ) {
    stashPendingStartAuto(message);
    return { ok: true as const };
  }

  return undefined;
});
