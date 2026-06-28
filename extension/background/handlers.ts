import { handleDiscordMessage } from "@ext/background/discord-handlers.ts";
import { handleRetailerMessage } from "@ext/background/retailer-handlers.ts";
import { handleUiMessage } from "@ext/background/ui-handlers.ts";
import {
  isDiscordContentSender,
  isExtensionPageSender,
  isRetailerContentSender,
} from "@ext/background/sender-auth.ts";
import type {
  BackgroundResponse,
  ContentToBackground,
  RetailerToBackground,
  RuntimeMessage,
  UiToBackground,
} from "@ext/types/index.ts";

function isDiscordContentMessage(
  message: RuntimeMessage,
): message is ContentToBackground {
  return (
    message.type === "CHANNEL_ACTIVE" ||
    message.type === "CHANNEL_INACTIVE" ||
    message.type === "CANDIDATE_LINKS" ||
    message.type === "ADD_ALLOWED_DOMAIN" ||
    message.type === "IGNORE_DOMAIN"
  );
}

function isRetailerContentMessage(message: RuntimeMessage): message is RetailerToBackground {
  return (
    message.type === "RETAILER_AUTO_STATUS" ||
    message.type === "RETAILER_GET_AUTO_CONFIG" ||
    message.type === "RETAILER_SET_REFRESH_INTERVAL" ||
    message.type === "RETAILER_HARD_RELOAD" ||
    message.type === "RETAILER_PING" ||
    message.type === "RETAILER_GET_TAB_AUTO_STATE" ||
    message.type === "RETAILER_SYNC_MANUAL_STOP" ||
    message.type === "RETAILER_SYNC_MANUAL_START" ||
    message.type === "RETAILER_UI_STATE"
  );
}

function isUiMessage(message: RuntimeMessage): message is UiToBackground {
  return (
    message.type === "GET_STATUS" ||
    message.type === "GET_SETTINGS" ||
    message.type === "SAVE_SETTINGS" ||
    message.type === "GET_HISTORY" ||
    message.type === "CLEAR_HISTORY" ||
    message.type === "GET_DETECTED_DOMAINS" ||
    message.type === "SET_RETAILER_AUTO_ENABLED" ||
    message.type === "SET_RETAILER_REFRESH_INTERVAL" ||
    message.type === "RETAILER_START_MANUAL_AUTO" ||
    message.type === "RETAILER_STOP_MANUAL_AUTO"
  );
}

export async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse | undefined> {
  try {
    if (isDiscordContentMessage(message)) {
      if (!isDiscordContentSender(sender)) {
        return { ok: false, error: "Unauthorized sender" };
      }
      return await handleDiscordMessage(message, sender);
    }

    if (isRetailerContentMessage(message)) {
      if (!isRetailerContentSender(sender)) {
        return { ok: false, error: "Unauthorized sender" };
      }
      return await handleRetailerMessage(message, sender);
    }

    if (isUiMessage(message)) {
      if (!isExtensionPageSender(sender)) {
        return { ok: false, error: "Unauthorized sender" };
      }
      return await handleUiMessage(message, sender);
    }

    if (message.type === "WATCH_CONFIG" || message.type === "PING") {
      return undefined;
    }

    if (
      message.type === "RETAILER_START_AUTO" ||
      message.type === "SCAN_DETECTED_DOMAINS"
    ) {
      return undefined;
    }

    return undefined;
  } catch (error) {
    console.error("Handler error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Handler failed" };
  }
}
