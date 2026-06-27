import type { ContentToBackground, RuntimeMessage, WatchConfig } from "@ext/types/index.ts";

const CANDIDATE_LINKS_MAX_RETRIES = 2;
const CANDIDATE_LINKS_RETRY_MS = 150;

export function sendToBackground<T = unknown>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function isWatchConfig(response: unknown): response is WatchConfig {
  return (
    typeof response === "object" &&
    response !== null &&
    (response as WatchConfig).type === "WATCH_CONFIG"
  );
}

export function isWatched(config: WatchConfig): boolean {
  return config.channel_id !== null && config.allowed_domains.length > 0;
}

export async function requestWatchConfig(channelId: string): Promise<WatchConfig | null> {
  const response = await sendToBackground({
    type: "CHANNEL_ACTIVE",
    channel_id: channelId,
  });
  return isWatchConfig(response) ? response : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendChannelInactive(): Promise<void> {
  try {
    await sendToBackground({ type: "CHANNEL_INACTIVE" });
  } catch (error) {
    console.warn("CookieScripts: CHANNEL_INACTIVE failed", error);
  }
}

export async function sendCandidateLinks(
  payload: Extract<ContentToBackground, { type: "CANDIDATE_LINKS" }>,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= CANDIDATE_LINKS_MAX_RETRIES; attempt++) {
    try {
      await sendToBackground(payload);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < CANDIDATE_LINKS_MAX_RETRIES) {
        await sleep(CANDIDATE_LINKS_RETRY_MS * (attempt + 1));
      }
    }
  }
  console.warn("CookieScripts: CANDIDATE_LINKS failed after retries", lastError);
}
