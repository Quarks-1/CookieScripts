import { extractHrefLinksFromMessage, isOwnMessage } from "@ext/content/extract.ts";
import { MESSAGE_ARTICLE } from "@ext/content/selectors.ts";
import { isBlockedSuggestionDomain } from "@ext/lib/blocked-domains.ts";
import { suggestionDomainFromUrl } from "@ext/lib/suggestion-domains.ts";

export function scanPageDomains(root: Element): string[] {
  const domains = new Set<string>();
  for (const article of root.querySelectorAll(MESSAGE_ARTICLE)) {
    if (isOwnMessage(article)) {
      continue;
    }
    for (const url of extractHrefLinksFromMessage(article)) {
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
