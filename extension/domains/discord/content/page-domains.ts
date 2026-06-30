import { extractLinksFromMessage, isOwnMessage } from "@ext/domains/discord/content/extract.ts";
import { MESSAGE_ARTICLE, MESSAGE_LIST_ITEM } from "@ext/domains/discord/content/selectors.ts";
import { isBlockedSuggestionDomain } from "@ext/core/lib/blocked-domains.ts";
import { suggestionDomainFromUrl } from "@ext/core/lib/suggestion-domains.ts";

/** Include embed/accessory siblings that sit outside the role=article message body. */
export function messageScanRoot(article: Element): Element {
  return (
    article.closest(MESSAGE_LIST_ITEM) ??
    article.closest('[id^="message-accessories-"]')?.parentElement ??
    article
  );
}

export function scanPageDomains(root: Element): string[] {
  const domains = new Set<string>();
  const scannedRoots = new Set<Element>();

  for (const article of root.querySelectorAll(MESSAGE_ARTICLE)) {
    if (isOwnMessage(article)) {
      continue;
    }

    const scanRoot = messageScanRoot(article);
    if (scannedRoots.has(scanRoot)) {
      continue;
    }
    scannedRoots.add(scanRoot);

    for (const url of extractLinksFromMessage(scanRoot)) {
      const domain = suggestionDomainFromUrl(url);
      if (domain && !isBlockedSuggestionDomain(domain)) {
        domains.add(domain);
      }
    }
  }
  return [...domains].sort();
}

export function filterSuggestibleDomains(
  scanned: string[],
  allowedDomains: string[],
  ignoredDomains: string[],
): string[] {
  const allowed = new Set(allowedDomains);
  const ignored = new Set(ignoredDomains);
  return scanned.filter((domain) => !allowed.has(domain) && !ignored.has(domain));
}
