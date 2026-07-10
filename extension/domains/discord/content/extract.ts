import { MAX_MESSAGE_TEXT_LENGTH } from "@ext/core/lib/constants.ts";
import { extractUrls, isHttpOrHttpsUrl } from "@ext/core/lib/links.ts";
import type { MessageAnchor } from "@ext/core/lib/sku-watch/types.ts";
import { AUTHOR, OWN_MESSAGE } from "@ext/domains/discord/content/selectors.ts";

const MESSAGE_ID_PATTERN = /^chat-messages-(\d+)$/;

export function getMessageId(root: Element): string | null {
  const id = root.id;
  if (id) {
    const match = MESSAGE_ID_PATTERN.exec(id);
    if (match) {
      return match[1];
    }
  }
  const listItemId = root.getAttribute("data-list-item-id");
  if (listItemId && /^\d+$/.test(listItemId)) {
    return listItemId;
  }
  const closestWithId = root.closest("[id^='chat-messages-']");
  if (closestWithId?.id) {
    const match = MESSAGE_ID_PATTERN.exec(closestWithId.id);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export function isOwnMessage(root: Element): boolean {
  if (root.closest(OWN_MESSAGE)) {
    return true;
  }
  if (root.getAttribute("data-is-author") === "true") {
    return true;
  }
  const ariaLabel = root.getAttribute("aria-label") ?? "";
  if (/^your message\b/i.test(ariaLabel)) {
    return true;
  }
  return false;
}

export function extractAuthor(root: Element): string {
  const authorEl = root.querySelector(AUTHOR);
  const text = authorEl?.textContent?.trim();
  return text || "unknown";
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}

export function extractMessageText(root: Element): string {
  const text = root.textContent ?? "";
  return text.length > MAX_MESSAGE_TEXT_LENGTH
    ? text.slice(0, MAX_MESSAGE_TEXT_LENGTH)
    : text;
}

export function extractLinksFromMessage(root: Element): string[] {
  const text = root.textContent ?? "";
  const hrefs = [...root.querySelectorAll("a[href]")]
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter(Boolean);
  const fromText = extractUrls(text);
  const fromHrefs = hrefs.filter(isHttpOrHttpsUrl);
  return dedupeUrls([...fromText, ...fromHrefs]);
}

export function extractHrefLinksFromMessage(root: Element): string[] {
  const hrefs = [...root.querySelectorAll("a[href]")]
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter(Boolean)
    .filter(isHttpOrHttpsUrl);
  return dedupeUrls(hrefs);
}

export function extractAnchorsFromMessage(root: Element): MessageAnchor[] {
  const seen = new Set<string>();
  const anchors: MessageAnchor[] = [];

  for (const element of root.querySelectorAll("a[href]")) {
    if (!(element instanceof HTMLAnchorElement)) {
      continue;
    }
    const href = element.href;
    if (!isHttpOrHttpsUrl(href) || seen.has(href)) {
      continue;
    }
    seen.add(href);
    anchors.push({
      href,
      text: element.textContent?.trim() ?? "",
    });
  }

  return anchors;
}
