import { upsertChannelDomains } from "@ext/lib/channel-targets.ts";
import type {
  BackgroundResponse,
  ContentToBackground,
  ExtensionSettings,
  ExtensionStatus,
  HistoryItem,
  RuntimeMessage,
  UiToBackground,
  WatchConfig,
} from "@ext/types/index.ts";

const CANDIDATE_LINKS_MAX_RETRIES = 2;
const CANDIDATE_LINKS_RETRY_MS = 150;
const UI_MESSAGE_MAX_RETRIES = 2;
const UI_MESSAGE_RETRY_MS = 150;

const EXTENSION_CONTEXT_INVALIDATED = "Extension context invalidated";

export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome.runtime.id === "string" && chrome.runtime.id.length > 0;
  } catch {
    return false;
  }
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes(EXTENSION_CONTEXT_INVALIDATED)
  );
}

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

export function isChannelActive(config: WatchConfig): boolean {
  return config.channel_id !== null;
}

export async function saveChannelDomains(
  channelId: string,
  domains: string[],
): Promise<void> {
  const settings = await getExtensionSettings();
  const next = upsertChannelDomains(settings, channelId, domains);
  await saveExtensionSettings(next);
}

export async function requestWatchConfig(channelId: string): Promise<WatchConfig | null> {
  if (!isExtensionContextValid()) {
    return null;
  }
  try {
    const response = await sendToBackground({
      type: "CHANNEL_ACTIVE",
      channel_id: channelId,
    });
    return isWatchConfig(response) ? response : null;
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return null;
    }
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendChannelInactive(): Promise<void> {
  if (!isExtensionContextValid()) {
    return;
  }
  try {
    await sendToBackground({ type: "CHANNEL_INACTIVE" });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return;
    }
    console.warn("CookieScripts: CHANNEL_INACTIVE failed", error);
  }
}

export async function sendCandidateLinks(
  payload: Extract<ContentToBackground, { type: "CANDIDATE_LINKS" }>,
): Promise<void> {
  if (!isExtensionContextValid()) {
    return;
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= CANDIDATE_LINKS_MAX_RETRIES; attempt++) {
    try {
      await sendToBackground(payload);
      return;
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return;
      }
      lastError = error;
      if (attempt < CANDIDATE_LINKS_MAX_RETRIES) {
        await sleep(CANDIDATE_LINKS_RETRY_MS * (attempt + 1));
      }
    }
  }
  console.warn("CookieScripts: CANDIDATE_LINKS failed after retries", lastError);
}

async function sendUiMessage(uiMessage: UiToBackground): Promise<BackgroundResponse> {
  if (!isExtensionContextValid()) {
    throw new Error(EXTENSION_CONTEXT_INVALIDATED);
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= UI_MESSAGE_MAX_RETRIES; attempt++) {
    try {
      const response = await sendToBackground<BackgroundResponse>(uiMessage);
      if (response === undefined) {
        throw new Error("No response from extension background");
      }
      return response;
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt < UI_MESSAGE_MAX_RETRIES) {
        await sleep(UI_MESSAGE_RETRY_MS * (attempt + 1));
      }
    }
  }
  const errorMessage =
    lastError instanceof Error ? lastError.message : "Extension messaging failed";
  throw new Error(errorMessage);
}

function assertOk(response: BackgroundResponse): void {
  if ("ok" in response && response.ok === false) {
    throw new Error(response.error);
  }
}

export async function getExtensionStatus(): Promise<ExtensionStatus> {
  const response = await sendUiMessage({ type: "GET_STATUS" });
  assertOk(response);
  if (!("status" in response)) {
    throw new Error("Unexpected GET_STATUS response");
  }
  return response.status;
}

export async function getExtensionSettings(): Promise<ExtensionSettings> {
  const response = await sendUiMessage({ type: "GET_SETTINGS" });
  assertOk(response);
  if (!("settings" in response)) {
    throw new Error("Unexpected GET_SETTINGS response");
  }
  return response.settings;
}

export async function saveExtensionSettings(settings: ExtensionSettings): Promise<void> {
  const response = await sendUiMessage({ type: "SAVE_SETTINGS", settings });
  assertOk(response);
}

export async function getLinkHistory(): Promise<HistoryItem[]> {
  const response = await sendUiMessage({ type: "GET_HISTORY" });
  assertOk(response);
  if (!("history" in response)) {
    throw new Error("Unexpected GET_HISTORY response");
  }
  return response.history;
}

export async function clearLinkHistory(): Promise<void> {
  const response = await sendUiMessage({ type: "CLEAR_HISTORY" });
  assertOk(response);
}
