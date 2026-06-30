import { MESSAGE_ARTICLE, MESSAGE_LIST } from "@ext/domains/discord/content/selectors.ts";

const LIST_DISCOVERY_TIMEOUT_MS = 30_000;

function findMessageArticles(node: Node): Element[] {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }
  const element = node as Element;
  const results: Element[] = [];
  if (element.matches(MESSAGE_ARTICLE)) {
    results.push(element);
  }
  results.push(...element.querySelectorAll(MESSAGE_ARTICLE));
  return results;
}

function attachMessageObserver(
  messageListRoot: Element,
  onMessageAdded: (node: Element) => void,
): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        for (const article of findMessageArticles(node)) {
          onMessageAdded(article);
        }
      }
    }
  });
  observer.observe(messageListRoot, { childList: true, subtree: true });
  return observer;
}

export function attachMessagePipeline(
  onMessageAdded: (node: Element) => void,
  onListReady?: (messageListRoot: Element) => void,
): () => void {
  let messageObserver: MutationObserver | null = null;
  let discoveryObserver: MutationObserver | null = null;
  let discoveryTimeout: ReturnType<typeof setTimeout> | null = null;
  let disconnected = false;

  const disconnect = () => {
    if (disconnected) {
      return;
    }
    disconnected = true;
    messageObserver?.disconnect();
    discoveryObserver?.disconnect();
    if (discoveryTimeout !== null) {
      clearTimeout(discoveryTimeout);
    }
    messageObserver = null;
    discoveryObserver = null;
    discoveryTimeout = null;
  };

  const onListFound = (messageListRoot: Element) => {
    if (disconnected) {
      return;
    }
    discoveryObserver?.disconnect();
    discoveryObserver = null;
    if (discoveryTimeout !== null) {
      clearTimeout(discoveryTimeout);
      discoveryTimeout = null;
    }
    onListReady?.(messageListRoot);
    messageObserver = attachMessageObserver(messageListRoot, onMessageAdded);
  };

  const existing = document.querySelector(MESSAGE_LIST);
  if (existing) {
    onListFound(existing);
    return disconnect;
  }

  discoveryObserver = new MutationObserver(() => {
    const list = document.querySelector(MESSAGE_LIST);
    if (list) {
      onListFound(list);
    }
  });
  discoveryObserver.observe(document.body, { childList: true, subtree: true });

  discoveryTimeout = setTimeout(() => {
    discoveryObserver?.disconnect();
    discoveryObserver = null;
  }, LIST_DISCOVERY_TIMEOUT_MS);

  return disconnect;
}
