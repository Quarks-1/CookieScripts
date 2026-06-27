import type { RuntimeMessage } from "@ext/types/index.ts";

export function sendToBackground(message: RuntimeMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}
