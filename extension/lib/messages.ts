import type { RuntimeMessage } from "@ext/types/index.ts";

export function sendToBackground<T = unknown>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
