import { extractUrls, isHttpOrHttpsUrl } from "@ext/lib/links.ts";
import { AUTHOR, OWN_MESSAGE } from "@ext/content/selectors.ts";

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

export function extractLinksFromMessage(root: Element): string[] {
  const text = root.textContent ?? "";
  const hrefs = [...root.querySelectorAll("a[href]")]
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter(Boolean);
  const fromText = extractUrls(text);
  const fromHrefs = hrefs.filter(isHttpOrHttpsUrl);
  return dedupeUrls([...fromText, ...fromHrefs]);
}
