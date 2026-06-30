import { filterSuggestibleDomains, scanPageDomains } from "@ext/domains/discord/content/page-domains.ts";
import { getChannelDomains } from "@ext/core/lib/channel-targets.ts";
import { getIgnoredDomains } from "@ext/core/lib/ignored-domains.ts";
import { isExtensionContextValid } from "@ext/core/lib/messages.ts";
import { getSettings } from "@ext/core/lib/storage.ts";
import type { BackgroundToContent } from "@ext/core/types/index.ts";

type ScanState = {
  channelId: string;
  messageListRoot: Element;
};

let state: ScanState | null = null;

async function scanSuggestibleDomains(): Promise<string[]> {
  if (!state || !isExtensionContextValid()) {
    return [];
  }

  const settings = await getSettings();
  const allowedDomains = getChannelDomains(settings, state.channelId);
  const ignoredDomains = await getIgnoredDomains(state.channelId);
  const scanned = scanPageDomains(state.messageListRoot);
  return filterSuggestibleDomains(scanned, allowedDomains, ignoredDomains);
}

export function stopDetectedDomainScan(): void {
  state = null;
}

export function startDetectedDomainScan(channelId: string, messageListRoot: Element): void {
  state = { channelId, messageListRoot };
}

export function installDetectedDomainsListener(): void {
  chrome.runtime.onMessage.addListener(
    (message: BackgroundToContent, _sender, sendResponse): boolean | undefined => {
      if (message.type !== "SCAN_DETECTED_DOMAINS") {
        return undefined;
      }
      void scanSuggestibleDomains().then((domains) => {
        sendResponse({ ok: true as const, domains });
      });
      return true;
    },
  );
}
